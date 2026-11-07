-- One-time extension of 001..006. Run this file in Supabase SQL Editor.
-- Existing coach links keep their role; new invitations can explicitly grant ADMIN or COACH.
BEGIN;
ALTER TABLE public.coach_invitations
 ADD COLUMN invite_role text NOT NULL DEFAULT 'COACH' CHECK(invite_role IN('ADMIN','COACH'));
GRANT SELECT(invite_role) ON public.coach_invitations TO authenticated;

-- All permission-changing paths take the same transaction lock, including direct RLS writes.
CREATE FUNCTION private.protect_account_access() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE target uuid; removing boolean:=false;
BEGIN
 IF current_setting('role',true) NOT IN('authenticated','anon') THEN
  IF TG_OP='DELETE' THEN RETURN old; ELSE RETURN new; END IF;
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(20261107,7);
 IF TG_TABLE_NAME='user_roles' THEN
  IF TG_OP='DELETE' THEN target:=old.user_id;removing:=old.role='ADMIN';
  ELSIF TG_OP='UPDATE' THEN target:=old.user_id;removing:=old.role='ADMIN' AND (new.role<>'ADMIN' OR new.user_id<>old.user_id);
  END IF;
 ELSE
  target:=old.id;
  removing:=old.is_active AND (TG_OP='DELETE' OR NOT new.is_active)
   AND EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=target AND role='ADMIN');
 END IF;
 IF removing THEN
  IF target=auth.uid() THEN RAISE EXCEPTION 'Cannot remove own administrator access' USING errcode='23514'; END IF;
  IF EXISTS(SELECT 1 FROM public.profiles WHERE id=target AND is_active)
   AND (SELECT count(*) FROM public.user_roles r JOIN public.profiles p ON p.id=r.user_id WHERE r.role='ADMIN' AND p.is_active)<=1 THEN
   RAISE EXCEPTION 'Last active administrator' USING errcode='23514';
  END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN old; ELSE RETURN new; END IF;
END $$;
REVOKE ALL ON FUNCTION private.protect_account_access() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER protect_roles BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
 FOR EACH ROW EXECUTE FUNCTION private.protect_account_access();
CREATE TRIGGER protect_profile_access BEFORE UPDATE OF is_active OR DELETE ON public.profiles
 FOR EACH ROW EXECUTE FUNCTION private.protect_account_access();

CREATE FUNCTION private.audit_role_removal() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_key,changed_fields)
 VALUES(auth.uid(),'DELETE','user_roles',jsonb_build_object('user_id',old.user_id,'role',old.role),ARRAY['role']);
 RETURN old;
END $$;
REVOKE ALL ON FUNCTION private.audit_role_removal() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER audit_role_removal AFTER DELETE ON public.user_roles
 FOR EACH ROW EXECUTE FUNCTION private.audit_role_removal();

CREATE FUNCTION public.list_club_accounts(page_offset integer DEFAULT 0)
RETURNS TABLE(id uuid,email text,display_name text,is_active boolean,roles text[],email_verified boolean,has_profile boolean,created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT private.has_role('ADMIN') THEN RAISE EXCEPTION 'Admin required' USING errcode='42501'; END IF;
 IF page_offset IS NULL OR page_offset<0 OR page_offset>500000 THEN RAISE EXCEPTION 'Invalid page' USING errcode='23514'; END IF;
 RETURN QUERY SELECT u.id,u.email::text,coalesce(p.display_name,u.email)::text,coalesce(p.is_active,false),
  ARRAY(SELECT r.role FROM public.user_roles r WHERE r.user_id=u.id ORDER BY r.role),u.email_confirmed_at IS NOT NULL,p.id IS NOT NULL,u.created_at
 FROM auth.users u LEFT JOIN public.profiles p ON p.id=u.id
 WHERE u.email IS NOT NULL ORDER BY u.created_at DESC,u.id LIMIT 50 OFFSET page_offset;
END $$;
REVOKE ALL ON FUNCTION public.list_club_accounts(integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.list_club_accounts(integer) TO authenticated;

CREATE FUNCTION public.update_club_account(target_user uuid,new_name text,requested_roles text[],active boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE verified timestamptz;
BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(20261107,7);
 IF NOT private.has_role('ADMIN') THEN RAISE EXCEPTION 'Admin required' USING errcode='42501'; END IF;
 IF new_name IS NULL OR length(trim(new_name)) NOT BETWEEN 1 AND 150 OR active IS NULL
 OR requested_roles IS NULL OR cardinality(requested_roles) NOT BETWEEN 1 AND 2
 OR EXISTS(SELECT 1 FROM unnest(requested_roles) r WHERE r IS NULL OR r NOT IN('ADMIN','COACH'))
 OR (SELECT count(DISTINCT r) FROM unnest(requested_roles) r)<>cardinality(requested_roles) THEN
  RAISE EXCEPTION 'Invalid account roles' USING errcode='23514'; END IF;
 SELECT email_confirmed_at INTO verified FROM auth.users WHERE id=target_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Account not found' USING errcode='P0002'; END IF;
 IF verified IS NULL THEN RAISE EXCEPTION 'Verified email required' USING errcode='23514'; END IF;
 IF target_user=auth.uid() AND (NOT active OR NOT ('ADMIN'=ANY(requested_roles))) THEN
  RAISE EXCEPTION 'Cannot remove own administrator access' USING errcode='23514'; END IF;
 INSERT INTO public.profiles(id,display_name,is_active) VALUES(target_user,trim(new_name),active)
 ON CONFLICT(id) DO UPDATE SET display_name=excluded.display_name,is_active=excluded.is_active;
 INSERT INTO public.user_roles(user_id,role) SELECT target_user,r FROM unnest(requested_roles) r
 ON CONFLICT(user_id,role) DO NOTHING;
 DELETE FROM public.user_roles WHERE user_id=target_user AND NOT(role=ANY(requested_roles));
 -- A manager's explicit role choice supersedes any older, still-pending invitation.
 UPDATE public.coach_invitations SET status='REVOKED'
 WHERE status='PENDING' AND email=(SELECT lower(email) FROM auth.users WHERE id=target_user);
END $$;
REVOKE ALL ON FUNCTION public.update_club_account(uuid,text,text[],boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_club_account(uuid,text,text[],boolean) TO authenticated;

CREATE FUNCTION public.remove_club_account(target_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE target_email text;
BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(20261107,7);
 IF NOT private.has_role('ADMIN') THEN RAISE EXCEPTION 'Admin required' USING errcode='42501'; END IF;
 IF target_user=auth.uid() THEN RAISE EXCEPTION 'Cannot remove own administrator access' USING errcode='23514'; END IF;
 SELECT lower(email) INTO target_email FROM auth.users WHERE id=target_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Account not found' USING errcode='P0002'; END IF;
 -- Keep Auth identity and all referenced historical records; revoke club access only.
 INSERT INTO public.profiles(id,display_name,is_active) VALUES(target_user,target_email,false)
 ON CONFLICT(id) DO UPDATE SET is_active=false;
 DELETE FROM public.user_roles WHERE user_id=target_user;
 UPDATE public.coach_invitations SET status='REVOKED'
 WHERE status='PENDING' AND (email=target_email OR created_by=target_user);
END $$;
REVOKE ALL ON FUNCTION public.remove_club_account(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.remove_club_account(uuid) TO authenticated;

CREATE FUNCTION public.create_account_invitation(invite_email text,invite_name text,invite_hash text,requested_role text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE invitation uuid;normalized text:=lower(trim(invite_email));
BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(20261107,7);
 IF NOT private.has_role('ADMIN') THEN RAISE EXCEPTION 'Admin required' USING errcode='42501'; END IF;
 IF normalized IS NULL OR length(normalized)>254 OR position('@' IN normalized)<2
 OR invite_name IS NULL OR length(trim(invite_name)) NOT BETWEEN 1 AND 150
 OR invite_hash IS NULL OR invite_hash !~ '^[a-f0-9]{64}$' OR requested_role IS NULL OR requested_role NOT IN('ADMIN','COACH') THEN
  RAISE EXCEPTION 'Invalid invitation' USING errcode='23514'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(normalized,0));
 IF EXISTS(SELECT 1 FROM auth.users u JOIN public.profiles p ON p.id=u.id JOIN public.user_roles r ON r.user_id=p.id
  WHERE lower(u.email)=normalized) THEN RAISE EXCEPTION 'Club account already exists' USING errcode='23505'; END IF;
 IF EXISTS(SELECT 1 FROM auth.users u JOIN public.profiles p ON p.id=u.id WHERE lower(u.email)=normalized AND NOT p.is_active) THEN
  RAISE EXCEPTION 'Inactive account must be managed by admin' USING errcode='23514'; END IF;
 UPDATE public.coach_invitations SET status='REVOKED' WHERE email=normalized AND status='PENDING';
 INSERT INTO public.coach_invitations(email,display_name,token_hash,invite_role)
 VALUES(normalized,trim(invite_name),invite_hash,requested_role) RETURNING id INTO invitation;
 RETURN invitation;
END $$;
REVOKE ALL ON FUNCTION public.create_account_invitation(text,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_account_invitation(text,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_coach_invitation(invite_email text,invite_name text,invite_hash text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN RETURN public.create_account_invitation(invite_email,invite_name,invite_hash,'COACH'); END $$;

CREATE FUNCTION public.lookup_account_invitation(invite_hash text)
RETURNS TABLE(email text,display_name text,expires_at timestamptz,status text,invite_role text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT i.email::text,i.display_name::text,i.expires_at,i.status,i.invite_role FROM public.coach_invitations i
 WHERE i.token_hash=invite_hash AND ((i.status='PENDING' AND i.expires_at>now()) OR(i.status='ACCEPTED' AND i.accepted_by=auth.uid()));
$$;
REVOKE ALL ON FUNCTION public.lookup_account_invitation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_account_invitation(text) TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.accept_coach_invitation(invite_hash text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE invitation public.coach_invitations;account_email text;confirmed timestamptz;actor uuid:=auth.uid();
BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(20261107,7);
 IF actor IS NULL THEN RAISE EXCEPTION 'Verified account required' USING errcode='42501'; END IF;
 SELECT lower(u.email),u.email_confirmed_at INTO account_email,confirmed FROM auth.users u WHERE u.id=actor;
 IF confirmed IS NULL OR account_email IS NULL THEN RAISE EXCEPTION 'Verified email required' USING errcode='42501'; END IF;
 SELECT * INTO invitation FROM public.coach_invitations WHERE token_hash=invite_hash FOR UPDATE;
 IF invitation.id IS NULL OR invitation.email<>account_email THEN RAISE EXCEPTION 'Invitation does not match account' USING errcode='42501'; END IF;
 IF EXISTS(SELECT 1 FROM public.profiles WHERE id=actor AND NOT is_active) THEN RAISE EXCEPTION 'Inactive account' USING errcode='42501'; END IF;
 IF invitation.status='ACCEPTED' AND invitation.accepted_by=actor THEN RETURN actor; END IF;
 IF invitation.status<>'PENDING' OR invitation.expires_at<=now() THEN RAISE EXCEPTION 'Invitation unavailable' USING errcode='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.user_roles r JOIN public.profiles p ON p.id=r.user_id
  WHERE r.user_id=invitation.created_by AND r.role='ADMIN' AND p.is_active) THEN
  RAISE EXCEPTION 'Invitation issuer no longer authorized' USING errcode='42501'; END IF;
 INSERT INTO public.profiles(id,display_name) VALUES(actor,invitation.display_name) ON CONFLICT(id) DO NOTHING;
 INSERT INTO public.user_roles(user_id,role) VALUES(actor,invitation.invite_role) ON CONFLICT(user_id,role) DO NOTHING;
 UPDATE public.coach_invitations SET status='ACCEPTED',accepted_by=actor,accepted_at=now() WHERE id=invitation.id;
 RETURN actor;
END $$;

CREATE OR REPLACE FUNCTION public.revoke_coach_invitation(invitation_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(20261107,7);
 IF NOT private.has_role('ADMIN') THEN RAISE EXCEPTION 'Admin required' USING errcode='42501'; END IF;
 UPDATE public.coach_invitations SET status='REVOKED' WHERE id=invitation_id AND status='PENDING';
 IF NOT FOUND THEN RAISE EXCEPTION 'Invitation already handled' USING errcode='40001'; END IF;
END $$;

-- Preserve the legacy coach editor while using the same lock order as account management.
CREATE OR REPLACE FUNCTION public.update_coach_account(coach_user uuid,new_name text,active boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(20261107,7);
 IF NOT private.has_role('ADMIN') THEN RAISE EXCEPTION 'Admin required' USING errcode='42501'; END IF;
 IF new_name IS NULL OR length(trim(new_name)) NOT BETWEEN 1 AND 150 OR active IS NULL THEN RAISE EXCEPTION 'Invalid coach account' USING errcode='23514'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=coach_user FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=coach_user AND role='COACH') THEN RAISE EXCEPTION 'Coach not found' USING errcode='P0002'; END IF;
 IF NOT active AND EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=coach_user AND role='ADMIN') THEN RAISE EXCEPTION 'Admin account cannot be disabled here' USING errcode='23514'; END IF;
 UPDATE public.profiles SET display_name=trim(new_name),is_active=active WHERE id=coach_user;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
