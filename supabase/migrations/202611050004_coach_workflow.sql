-- Match the club's local calendar, including the UTC/Istanbul midnight boundary.
CREATE OR REPLACE FUNCTION private.coaches_term(
 term uuid, on_date date DEFAULT ((now() AT TIME ZONE 'Europe/Istanbul')::date)
) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT private.has_role('COACH') AND EXISTS (
  SELECT 1 FROM public.coach_assignments a
  WHERE a.coach_id=auth.uid() AND a.group_term_id=term
  AND on_date BETWEEN a.starts_on AND a.ends_on
 )
$$;
CREATE OR REPLACE FUNCTION private.sees_athlete(athlete uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT private.has_role('COACH') AND (
  EXISTS(SELECT 1 FROM public.enrollments e WHERE e.athlete_id=athlete
   AND (now() AT TIME ZONE 'Europe/Istanbul')::date
     BETWEEN e.joined_on AND COALESCE(e.left_on,'infinity'::date)
   AND private.coaches_term(e.group_term_id))
  OR EXISTS(SELECT 1 FROM public.session_athletes a
   WHERE a.athlete_id=athlete AND private.owns_session(a.session_id))
 )
$$;
-- Only metadata for lessons actually assigned to this coach, not peer data.
CREATE POLICY coach_term_lesson_history ON public.group_terms FOR SELECT TO authenticated
USING(private.has_role('COACH') AND EXISTS(
 SELECT 1 FROM public.sessions s WHERE s.group_term_id=group_terms.id
 AND private.owns_session(s.id)
));
CREATE POLICY coach_group_lesson_history ON public.groups FOR SELECT TO authenticated
USING(private.has_role('COACH') AND EXISTS(
 SELECT 1 FROM public.group_terms t JOIN public.sessions s ON s.group_term_id=t.id
 WHERE t.group_id=groups.id AND private.owns_session(s.id)
));

-- Invoker security preserves RLS; one SQL transaction saves the entire selection.
CREATE FUNCTION public.record_my_attendance(lesson uuid, entries jsonb)
RETURNS SETOF public.athlete_attendance
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE item jsonb; affected integer;
BEGIN
 IF NOT private.has_role('COACH') OR NOT private.owns_session(lesson) THEN
  RAISE EXCEPTION 'Own coach lesson required' USING errcode='42501';
 END IF;
 IF entries IS NULL OR jsonb_typeof(entries)<>'array' THEN
  RAISE EXCEPTION 'Attendance array required' USING errcode='23514';
 END IF;
 IF jsonb_array_length(entries) NOT BETWEEN 1 AND 100 THEN
  RAISE EXCEPTION 'Select between 1 and 100 athletes' USING errcode='23514';
 END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(entries) LOOP
  IF jsonb_typeof(item)<>'object' THEN
   RAISE EXCEPTION 'Invalid attendance entry' USING errcode='23514';
  END IF;
  IF item-ARRAY['athlete_id','status','note']<>'{}'::jsonb
   OR jsonb_typeof(item->'athlete_id') IS DISTINCT FROM 'string'
   OR jsonb_typeof(item->'status') IS DISTINCT FROM 'string'
   OR item->>'status' NOT IN ('PRESENT','ABSENT','EXCUSED') THEN
   RAISE EXCEPTION 'Invalid attendance entry' USING errcode='23514';
  END IF;
  IF item?'note' AND jsonb_typeof(item->'note') NOT IN ('string','null') THEN
   RAISE EXCEPTION 'Invalid attendance note' USING errcode='23514';
  END IF;
  IF length(item->>'note')>500 THEN
   RAISE EXCEPTION 'Attendance note too long' USING errcode='23514';
  END IF;
 END LOOP;
 IF (SELECT count(DISTINCT (value->>'athlete_id')::uuid)
   FROM jsonb_array_elements(entries))<>jsonb_array_length(entries) THEN
  RAISE EXCEPTION 'Duplicate athlete in attendance selection' USING errcode='23514';
 END IF;
 RETURN QUERY INSERT INTO public.athlete_attendance(session_id,athlete_id,status,note)
 SELECT lesson,(value->>'athlete_id')::uuid,value->>'status',value->>'note'
 FROM jsonb_array_elements(entries)
 ON CONFLICT(session_id,athlete_id) DO UPDATE
 SET status=excluded.status,note=excluded.note
 WHERE athlete_attendance.recorded_by=auth.uid()
 RETURNING athlete_attendance.*;
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>jsonb_array_length(entries) THEN
  RAISE EXCEPTION 'Own coach attendance required' USING errcode='42501';
 END IF;
END
$$;
REVOKE ALL ON FUNCTION public.record_my_attendance(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_my_attendance(uuid,jsonb) TO authenticated;
