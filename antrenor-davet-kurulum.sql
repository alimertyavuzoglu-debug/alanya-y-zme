-- Bir defalik antrenor davet sistemi kurulumu. Onceki kurulumlari tekrar calistirmayin.
BEGIN;
-- Admin-created, email-bound invitations. Only hashes are stored; no Auth admin key is needed.
CREATE TABLE public.coach_invitations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 email varchar(254) NOT NULL CHECK(email=lower(trim(email)) AND position('@' IN email)>1),
 display_name varchar(150) NOT NULL CHECK(length(trim(display_name))>0),
 token_hash text NOT NULL UNIQUE CHECK(token_hash ~ '^[a-f0-9]{64}$'),
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN('PENDING','ACCEPTED','REVOKED')),
 created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '7 days',
 accepted_by uuid REFERENCES public.profiles(id), accepted_at timestamptz,
 CHECK((status='ACCEPTED' AND accepted_by IS NOT NULL AND accepted_at IS NOT NULL)
  OR(status<>'ACCEPTED' AND accepted_by IS NULL AND accepted_at IS NULL))
);
CREATE UNIQUE INDEX one_pending_coach_invite ON public.coach_invitations(email) WHERE status='PENDING';
ALTER TABLE public.coach_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.coach_invitations FROM anon,authenticated;
GRANT SELECT(id,email,display_name,status,created_by,created_at,expires_at,accepted_by,accepted_at)
 ON public.coach_invitations TO authenticated;
CREATE POLICY admin_invitation_read ON public.coach_invitations FOR SELECT TO authenticated
 USING(private.has_role('ADMIN'));
CREATE TRIGGER audit_coach_invitation AFTER INSERT OR UPDATE ON public.coach_invitations
 FOR EACH ROW EXECUTE FUNCTION private.audit_change();

CREATE FUNCTION public.create_coach_invitation(invite_email text,invite_name text,invite_hash text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE invitation uuid; normalized text:=lower(trim(invite_email));
BEGIN
 IF NOT private.has_role('ADMIN') THEN RAISE EXCEPTION 'Admin required' USING errcode='42501'; END IF;
 IF normalized IS NULL OR length(normalized)>254 OR position('@' IN normalized)<2
 OR invite_name IS NULL OR length(trim(invite_name)) NOT BETWEEN 1 AND 150
 OR invite_hash IS NULL OR invite_hash !~ '^[a-f0-9]{64}$' THEN
  RAISE EXCEPTION 'Invalid invitation' USING errcode='23514'; END IF;
 -- Serialize replacement invitations for the same email, including first-time invitations.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(normalized,0));
 IF EXISTS(SELECT 1 FROM auth.users u JOIN public.profiles p ON p.id=u.id
  JOIN public.user_roles r ON r.user_id=p.id WHERE lower(u.email)=normalized AND r.role='COACH') THEN
  RAISE EXCEPTION 'Coach account already exists' USING errcode='23505'; END IF;
 IF EXISTS(SELECT 1 FROM auth.users u JOIN public.profiles p ON p.id=u.id
  WHERE lower(u.email)=normalized AND NOT p.is_active) THEN
  RAISE EXCEPTION 'Inactive account must be managed by admin' USING errcode='23514'; END IF;
 UPDATE public.coach_invitations SET status='REVOKED' WHERE email=normalized AND status='PENDING';
 INSERT INTO public.coach_invitations(email,display_name,token_hash)
 VALUES(normalized,trim(invite_name),invite_hash) RETURNING id INTO invitation;
 RETURN invitation;
END $$;
REVOKE ALL ON FUNCTION public.create_coach_invitation(text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_coach_invitation(text,text,text) TO authenticated;

CREATE FUNCTION public.lookup_coach_invitation(invite_hash text)
RETURNS TABLE(email text,display_name text,expires_at timestamptz,status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT i.email::text,i.display_name::text,i.expires_at,i.status FROM public.coach_invitations i
 WHERE i.token_hash=invite_hash AND ((i.status='PENDING' AND i.expires_at>now())
  OR(i.status='ACCEPTED' AND i.accepted_by=auth.uid()));
$$;
REVOKE ALL ON FUNCTION public.lookup_coach_invitation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_coach_invitation(text) TO anon,authenticated;

CREATE FUNCTION public.accept_coach_invitation(invite_hash text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE invitation public.coach_invitations; account_email text; confirmed timestamptz; actor uuid:=auth.uid();
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Verified account required' USING errcode='42501'; END IF;
 SELECT lower(u.email),u.email_confirmed_at INTO account_email,confirmed FROM auth.users u WHERE u.id=actor;
 IF confirmed IS NULL OR account_email IS NULL THEN
  RAISE EXCEPTION 'Verified email required' USING errcode='42501'; END IF;
 SELECT * INTO invitation FROM public.coach_invitations WHERE token_hash=invite_hash FOR UPDATE;
 IF invitation.id IS NULL OR invitation.email<>account_email THEN
  RAISE EXCEPTION 'Invitation does not match account' USING errcode='42501'; END IF;
 IF EXISTS(SELECT 1 FROM public.profiles WHERE id=actor AND NOT is_active) THEN
  RAISE EXCEPTION 'Inactive account' USING errcode='42501'; END IF;
 -- Retrying a successful accept is safe for the same verified account only.
 IF invitation.status='ACCEPTED' AND invitation.accepted_by=actor THEN RETURN actor; END IF;
 IF invitation.status<>'PENDING' OR invitation.expires_at<=now() THEN
  RAISE EXCEPTION 'Invitation unavailable' USING errcode='23514'; END IF;
 INSERT INTO public.profiles(id,display_name) VALUES(actor,invitation.display_name) ON CONFLICT(id) DO NOTHING;
 INSERT INTO public.user_roles(user_id,role) VALUES(actor,'COACH') ON CONFLICT(user_id,role) DO NOTHING;
 UPDATE public.coach_invitations SET status='ACCEPTED',accepted_by=actor,accepted_at=now() WHERE id=invitation.id;
 RETURN actor;
END $$;
REVOKE ALL ON FUNCTION public.accept_coach_invitation(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.accept_coach_invitation(text) TO authenticated;

CREATE FUNCTION public.revoke_coach_invitation(invitation_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT private.has_role('ADMIN') THEN RAISE EXCEPTION 'Admin required' USING errcode='42501'; END IF;
 UPDATE public.coach_invitations SET status='REVOKED' WHERE id=invitation_id AND status='PENDING';
 IF NOT FOUND THEN RAISE EXCEPTION 'Invitation already handled' USING errcode='40001'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.revoke_coach_invitation(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.revoke_coach_invitation(uuid) TO authenticated;

CREATE FUNCTION public.update_coach_account(coach_user uuid,new_name text,active boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT private.has_role('ADMIN') THEN RAISE EXCEPTION 'Admin required' USING errcode='42501'; END IF;
 IF new_name IS NULL OR length(trim(new_name)) NOT BETWEEN 1 AND 150 OR active IS NULL THEN
  RAISE EXCEPTION 'Invalid coach account' USING errcode='23514'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=coach_user FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=coach_user AND role='COACH') THEN
  RAISE EXCEPTION 'Coach not found' USING errcode='P0002'; END IF;
 IF NOT active AND EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=coach_user AND role='ADMIN') THEN
  RAISE EXCEPTION 'Admin account cannot be disabled here' USING errcode='23514'; END IF;
 UPDATE public.profiles SET display_name=trim(new_name),is_active=active WHERE id=coach_user;
END $$;
REVOKE ALL ON FUNCTION public.update_coach_account(uuid,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_coach_account(uuid,text,boolean) TO authenticated;

COMMIT;
