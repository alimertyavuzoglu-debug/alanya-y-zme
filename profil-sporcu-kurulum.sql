-- Mevcut projede yalnizca bu ek kurulumu bir kez calistirin (001-004 tekrar gerekmez).
BEGIN;
-- Personal coach details remain private; only display_name is shared with staff.
CREATE TABLE public.coach_profiles (
 user_id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES public.profiles(id),
 phone varchar(30), city varchar(100), specialization varchar(150), bio varchar(1500),
 avatar_path text CHECK(avatar_path IS NULL OR split_part(avatar_path,'/',1)=user_id::text), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.coach_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.coach_profiles FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.coach_profiles TO authenticated;
CREATE POLICY own_coach_profile_read ON public.coach_profiles FOR SELECT TO authenticated
 USING(user_id=auth.uid() AND private.has_role('COACH'));
CREATE POLICY own_coach_profile_insert ON public.coach_profiles FOR INSERT TO authenticated
 WITH CHECK(user_id=auth.uid() AND private.has_role('COACH'));
CREATE POLICY own_coach_profile_update ON public.coach_profiles FOR UPDATE TO authenticated
 USING(user_id=auth.uid() AND private.has_role('COACH'))
 WITH CHECK(user_id=auth.uid() AND private.has_role('COACH'));
CREATE POLICY own_coach_display_name ON public.profiles FOR UPDATE TO authenticated
 USING(id=auth.uid() AND private.has_role('COACH'))
 WITH CHECK(id=auth.uid() AND private.has_role('COACH'));
CREATE FUNCTION private.guard_profile_columns() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF current_setting('role',true) IN ('authenticated','anon') AND NOT private.has_role('ADMIN') AND
  (to_jsonb(new)-'display_name') IS DISTINCT FROM (to_jsonb(old)-'display_name') THEN
  RAISE EXCEPTION 'Only display name may change' USING errcode='42501';
 END IF;
 RETURN new;
END $$;
CREATE TRIGGER guard_profile_columns BEFORE UPDATE ON public.profiles
 FOR EACH ROW EXECUTE FUNCTION private.guard_profile_columns();
REVOKE ALL ON FUNCTION private.guard_profile_columns() FROM PUBLIC,anon,authenticated;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('coach-avatars','coach-avatars',false,3145728,ARRAY['image/png','image/jpeg','image/webp']);
CREATE POLICY own_avatar_read ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id='coach-avatars' AND split_part(name,'/',1)=auth.uid()::text AND private.has_role('COACH'));
CREATE POLICY own_avatar_insert ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='coach-avatars' AND split_part(name,'/',1)=auth.uid()::text AND private.has_role('COACH'));
CREATE POLICY own_avatar_delete ON storage.objects FOR DELETE TO authenticated
 USING(bucket_id='coach-avatars' AND split_part(name,'/',1)=auth.uid()::text AND private.has_role('COACH'));
CREATE FUNCTION public.save_my_coach_profile(payload jsonb) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE avatar text:=NULLIF(payload->>'avatar_path','');
BEGIN
 IF NOT private.has_role('COACH') THEN RAISE EXCEPTION 'Coach required' USING errcode='42501'; END IF;
 IF jsonb_typeof(payload)<>'object' OR payload-ARRAY['display_name','phone','city','specialization','bio','avatar_path']<>'{}'::jsonb
 OR length(trim(payload->>'display_name')) NOT BETWEEN 1 AND 150 OR payload->>'display_name' IS NULL THEN
  RAISE EXCEPTION 'Invalid profile' USING errcode='23514'; END IF;
 IF avatar IS NOT NULL AND (split_part(avatar,'/',1)<>auth.uid()::text OR NOT EXISTS(
  SELECT 1 FROM storage.objects WHERE bucket_id='coach-avatars' AND name=avatar
 )) THEN RAISE EXCEPTION 'Invalid avatar ownership' USING errcode='42501'; END IF;
 UPDATE public.profiles SET display_name=trim(payload->>'display_name') WHERE id=auth.uid();
 INSERT INTO public.coach_profiles(user_id,phone,city,specialization,bio,avatar_path)
 VALUES(auth.uid(),NULLIF(trim(payload->>'phone'),''),NULLIF(trim(payload->>'city'),''),
  NULLIF(trim(payload->>'specialization'),''),NULLIF(trim(payload->>'bio'),''),avatar)
 ON CONFLICT(user_id) DO UPDATE SET phone=excluded.phone,city=excluded.city,
 specialization=excluded.specialization,bio=excluded.bio,avatar_path=excluded.avatar_path,updated_at=now();
END $$;
REVOKE ALL ON FUNCTION public.save_my_coach_profile(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_my_coach_profile(jsonb) TO authenticated;
CREATE TRIGGER audit_coach_profile AFTER INSERT OR UPDATE ON public.coach_profiles
 FOR EACH ROW EXECUTE FUNCTION private.audit_change();

CREATE TABLE public.athlete_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 coach_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
 group_term_id uuid NOT NULL REFERENCES public.group_terms(id),
 session_id uuid REFERENCES public.sessions(id),
 first_name varchar(100) NOT NULL CHECK(length(trim(first_name))>0),
 last_name varchar(100) NOT NULL CHECK(length(trim(last_name))>0),
 birth_date date, joined_on date NOT NULL, note varchar(500),
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN('PENDING','APPROVED','REJECTED')),
 reviewed_by uuid REFERENCES public.profiles(id), reviewed_at timestamptz, review_note varchar(500),
 athlete_id uuid REFERENCES public.athletes(id), created_at timestamptz NOT NULL DEFAULT now(),
 CHECK((status='PENDING' AND reviewed_by IS NULL AND reviewed_at IS NULL AND athlete_id IS NULL)
 OR(status='APPROVED' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND athlete_id IS NOT NULL)
 OR(status='REJECTED' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND athlete_id IS NULL))
);
CREATE INDEX athlete_requests_coach_status ON public.athlete_requests(coach_id,status,created_at);
ALTER TABLE public.athlete_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.athlete_requests FROM anon,authenticated;
GRANT SELECT ON public.athlete_requests TO authenticated;
GRANT INSERT(group_term_id,session_id,first_name,last_name,birth_date,joined_on,note) ON public.athlete_requests TO authenticated;
CREATE POLICY read_athlete_requests ON public.athlete_requests FOR SELECT TO authenticated
 USING(private.has_role('ADMIN') OR (coach_id=auth.uid() AND private.has_role('COACH')));
CREATE POLICY request_own_group ON public.athlete_requests FOR INSERT TO authenticated
 WITH CHECK(coach_id=auth.uid() AND private.has_role('COACH') AND private.coaches_term(group_term_id,joined_on));
CREATE FUNCTION private.validate_athlete_request() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t public.group_terms; lesson public.sessions;
BEGIN
 SELECT * INTO t FROM public.group_terms WHERE id=new.group_term_id;
 IF t.id IS NULL OR t.status='CLOSED' OR new.joined_on NOT BETWEEN t.start_date AND t.end_date THEN
  RAISE EXCEPTION 'Request dates outside open term' USING errcode='23514'; END IF;
 IF new.session_id IS NOT NULL THEN
  SELECT * INTO lesson FROM public.sessions WHERE id=new.session_id;
  IF lesson.id IS NULL OR lesson.group_term_id<>new.group_term_id OR lesson.status='CANCELLED'
   OR new.joined_on>(lesson.starts_at AT TIME ZONE 'Europe/Istanbul')::date
   OR NOT private.owns_session(new.session_id) THEN
   RAISE EXCEPTION 'Own lesson required for request' USING errcode='42501'; END IF;
 END IF;
 IF new.birth_date>(now() AT TIME ZONE 'Europe/Istanbul')::date THEN
  RAISE EXCEPTION 'Birth date is in future' USING errcode='23514'; END IF;
 RETURN new;
END $$;
CREATE TRIGGER validate_athlete_request BEFORE INSERT ON public.athlete_requests
 FOR EACH ROW EXECUTE FUNCTION private.validate_athlete_request();
REVOKE ALL ON FUNCTION private.validate_athlete_request() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER audit_athlete_request AFTER INSERT OR UPDATE ON public.athlete_requests
 FOR EACH ROW EXECUTE FUNCTION private.audit_change();
CREATE FUNCTION public.review_athlete_request(
 request_id uuid, decision text, existing_athlete uuid DEFAULT NULL, review_message text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.athlete_requests; t public.group_terms; athlete uuid; enrollment uuid; lesson_day date;
BEGIN
 IF NOT private.has_role('ADMIN') THEN RAISE EXCEPTION 'Admin required' USING errcode='42501'; END IF;
 SELECT * INTO r FROM public.athlete_requests WHERE id=request_id FOR UPDATE;
 IF r.id IS NULL THEN RAISE EXCEPTION 'Request not found' USING errcode='P0002'; END IF;
 IF r.status<>'PENDING' THEN RAISE EXCEPTION 'Request already reviewed' USING errcode='40001'; END IF;
 IF decision NOT IN('APPROVED','REJECTED') OR decision IS NULL OR length(review_message)>500 THEN
  RAISE EXCEPTION 'Invalid review' USING errcode='23514'; END IF;
 IF decision='REJECTED' THEN
  IF NULLIF(trim(review_message),'') IS NULL THEN RAISE EXCEPTION 'Rejection reason required' USING errcode='23514'; END IF;
  UPDATE public.athlete_requests SET status='REJECTED',reviewed_by=auth.uid(),reviewed_at=now(),review_note=trim(review_message) WHERE id=r.id;
  RETURN NULL;
 END IF;
 SELECT * INTO t FROM public.group_terms WHERE id=r.group_term_id FOR UPDATE;
 IF t.status='CLOSED' OR r.joined_on NOT BETWEEN t.start_date AND t.end_date THEN
  RAISE EXCEPTION 'Request dates outside open term' USING errcode='23514'; END IF;
 IF r.session_id IS NOT NULL THEN
  SELECT (s.starts_at AT TIME ZONE 'Europe/Istanbul')::date INTO lesson_day
   FROM public.sessions s WHERE s.id=r.session_id AND s.status<>'CANCELLED' FOR UPDATE;
  IF lesson_day IS NULL THEN RAISE EXCEPTION 'Request lesson cancelled' USING errcode='23514'; END IF;
 END IF;
 IF existing_athlete IS NOT NULL THEN
  SELECT id INTO athlete FROM public.athletes WHERE id=existing_athlete AND is_active;
  IF athlete IS NULL THEN RAISE EXCEPTION 'Active athlete required' USING errcode='23514'; END IF;
 ELSE
  INSERT INTO public.athletes(first_name,last_name,birth_date) VALUES(r.first_name,r.last_name,r.birth_date) RETURNING id INTO athlete;
 END IF;
 SELECT e.id INTO enrollment FROM public.enrollments e WHERE e.group_term_id=r.group_term_id AND e.athlete_id=athlete
  AND r.joined_on BETWEEN e.joined_on AND COALESCE(e.left_on,t.end_date) ORDER BY e.joined_on DESC LIMIT 1;
 IF enrollment IS NULL THEN
  INSERT INTO public.enrollments(group_term_id,athlete_id,joined_on) VALUES(r.group_term_id,athlete,r.joined_on) RETURNING id INTO enrollment;
 END IF;
 IF r.session_id IS NOT NULL THEN
  INSERT INTO public.session_athletes(session_id,athlete_id,enrollment_id) VALUES(r.session_id,athlete,enrollment)
   ON CONFLICT(session_id,athlete_id) DO NOTHING;
 END IF;
 UPDATE public.athlete_requests SET status='APPROVED',athlete_id=athlete,reviewed_by=auth.uid(),reviewed_at=now(),review_note=NULLIF(trim(review_message),'') WHERE id=r.id;
 RETURN athlete;
END $$;
REVOKE ALL ON FUNCTION public.review_athlete_request(uuid,text,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.review_athlete_request(uuid,text,uuid,text) TO authenticated;

CREATE FUNCTION public.create_lesson_bundle(payload jsonb) RETURNS SETOF public.sessions
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE lesson public.sessions; term uuid; coach uuid; day date; student uuid; enrollment uuid; ids jsonb;
BEGIN
 IF NOT private.has_role('ADMIN') THEN RAISE EXCEPTION 'Admin required' USING errcode='42501'; END IF;
 term:=(payload->>'group_term_id')::uuid; coach:=(payload->>'coach_id')::uuid;
 PERFORM 1 FROM public.group_terms WHERE id=term AND status<>'CLOSED' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Open term required' USING errcode='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles p JOIN public.user_roles r ON r.user_id=p.id
  WHERE p.id=coach AND p.is_active AND r.role='COACH') THEN
  RAISE EXCEPTION 'Active coach required' USING errcode='23514'; END IF;
 ids:=COALESCE(payload->'athlete_ids','[]'::jsonb);
 IF jsonb_typeof(ids)<>'array' THEN RAISE EXCEPTION 'Invalid athlete list' USING errcode='23514'; END IF;
 IF jsonb_array_length(ids)>200 OR (SELECT count(DISTINCT (value#>>'{}')::uuid) FROM jsonb_array_elements(ids))<>jsonb_array_length(ids) THEN
  RAISE EXCEPTION 'Invalid athlete list' USING errcode='23514'; END IF;
 INSERT INTO public.sessions(group_term_id,training_plan_id,starts_at,ends_at)
 VALUES(term,NULLIF(payload->>'training_plan_id','')::uuid,(payload->>'starts_at')::timestamptz,(payload->>'ends_at')::timestamptz)
 RETURNING * INTO lesson;
 day:=(lesson.starts_at AT TIME ZONE 'Europe/Istanbul')::date;
 IF NOT EXISTS(SELECT 1 FROM public.coach_assignments a WHERE a.coach_id=coach AND a.group_term_id=term AND day BETWEEN a.starts_on AND a.ends_on)
 AND COALESCE((payload->>'create_assignment')::boolean,false) THEN
  INSERT INTO public.coach_assignments(group_term_id,coach_id,starts_on,ends_on) VALUES(term,coach,day,day);
 END IF;
 INSERT INTO public.session_coaches(session_id,coach_id) VALUES(lesson.id,coach);
 FOR student IN SELECT (value#>>'{}')::uuid FROM jsonb_array_elements(ids) LOOP
  enrollment:=NULL;
  SELECT e.id INTO enrollment FROM public.enrollments e JOIN public.athletes a ON a.id=e.athlete_id
   WHERE e.group_term_id=term AND e.athlete_id=student AND a.is_active
   AND day BETWEEN e.joined_on AND COALESCE(e.left_on,'infinity'::date) LIMIT 1;
  IF enrollment IS NULL THEN RAISE EXCEPTION 'Invalid lesson membership' USING errcode='23514'; END IF;
  INSERT INTO public.session_athletes(session_id,athlete_id,enrollment_id) VALUES(lesson.id,student,enrollment);
 END LOOP;
 RETURN NEXT lesson;
END $$;
REVOKE ALL ON FUNCTION public.create_lesson_bundle(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_lesson_bundle(jsonb) TO authenticated;

COMMIT;
