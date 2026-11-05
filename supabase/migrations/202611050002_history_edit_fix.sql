-- Fix table-specific NEW/OLD field lookup in shared history trigger.
CREATE OR REPLACE FUNCTION private.lock_historical_ranges()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF tg_table_name = 'enrollments' THEN
    IF EXISTS (
      SELECT 1
      FROM public.session_athletes a
      JOIN public.sessions s ON s.id = a.session_id
      WHERE a.enrollment_id = new.id
        AND (s.starts_at AT TIME ZONE 'Europe/Istanbul')::date
          NOT BETWEEN new.joined_on
            AND COALESCE(new.left_on, 'infinity'::date)
    ) THEN
      RAISE EXCEPTION 'Membership change invalidates a lesson roster'
        USING errcode = '23514';
    END IF;
  ELSIF tg_table_name = 'coach_assignments' THEN
    IF EXISTS (
      SELECT 1
      FROM public.session_coaches c
      JOIN public.sessions s ON s.id = c.session_id
      WHERE c.coach_id = new.coach_id
        AND s.group_term_id = new.group_term_id
        AND (s.starts_at AT TIME ZONE 'Europe/Istanbul')::date
          BETWEEN old.starts_on AND old.ends_on
        AND (s.starts_at AT TIME ZONE 'Europe/Istanbul')::date
          NOT BETWEEN new.starts_on AND new.ends_on
    ) THEN
      RAISE EXCEPTION 'Assignment change invalidates a lesson'
        USING errcode = '23514';
    END IF;
  END IF;
  RETURN new;
END
$$;
REVOKE ALL ON FUNCTION private.lock_historical_ranges()
FROM PUBLIC, anon, authenticated;
