-- Supabase PostgreSQL. Auth identities are managed by Supabase Auth.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.profiles (
 id uuid primary key references auth.users(id),
 display_name text not null check(length(display_name) between 1 and 150),
 is_active boolean not null default true,
 created_at timestamptz not null default now()
);
create table public.user_roles (
 user_id uuid not null references public.profiles(id),
 role text not null check(role in ('ADMIN','COACH')),
 primary key(user_id,role)
);
create table public.athletes (
 id uuid primary key default gen_random_uuid(),
 first_name text not null check(length(first_name) between 1 and 100),
 last_name text not null check(length(last_name) between 1 and 100),
 birth_date date, is_active boolean not null default true,
 created_at timestamptz not null default now()
);
create table public.guardians (
 id uuid primary key default gen_random_uuid(),
 name text not null, phone text, email text,
 created_at timestamptz not null default now()
);
create table public.athlete_guardians (
 athlete_id uuid not null references public.athletes(id),
 guardian_id uuid not null references public.guardians(id),
 relationship text not null, is_primary boolean not null default false,
 primary key(athlete_id,guardian_id)
);
create unique index one_primary_guardian on public.athlete_guardians(athlete_id) where is_primary;
create table public.groups (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(name) between 1 and 150),
 sport text not null default 'SWIMMING', level text,
 is_active boolean not null default true, created_at timestamptz not null default now()
);
create table public.group_terms (
 id uuid primary key default gen_random_uuid(), group_id uuid not null references public.groups(id),
 name text not null, start_date date not null, end_date date not null,
 status text not null default 'DRAFT' check(status in ('DRAFT','ACTIVE','CLOSED')),
 created_at timestamptz not null default now(), check(end_date >= start_date)
);
create table public.enrollments (
 id uuid primary key default gen_random_uuid(), group_term_id uuid not null references public.group_terms(id),
 athlete_id uuid not null references public.athletes(id), joined_on date not null, left_on date,
 created_at timestamptz not null default now(), check(left_on is null or left_on >= joined_on)
);
create index enrollments_lookup on public.enrollments(group_term_id,athlete_id);
create table public.coach_assignments (
 id uuid primary key default gen_random_uuid(), group_term_id uuid not null references public.group_terms(id),
 coach_id uuid not null references public.profiles(id), starts_on date not null, ends_on date not null,
 created_at timestamptz not null default now(), check(ends_on >= starts_on)
);
create index assignments_coach on public.coach_assignments(coach_id,group_term_id);
create table public.training_plans (
 id uuid primary key default gen_random_uuid(), group_term_id uuid references public.group_terms(id),
 title text not null check(length(title) between 1 and 200), content text not null check(length(content)<=20000),
 created_by uuid not null default auth.uid() references public.profiles(id),
 created_at timestamptz not null default now()
);
create table public.schedule_rules (
 id uuid primary key default gen_random_uuid(), group_term_id uuid not null references public.group_terms(id),
 weekday smallint not null check(weekday between 1 and 7), local_start_time time not null,
 duration_minutes integer not null check(duration_minutes between 1 and 720),
 timezone text not null default 'Europe/Istanbul' check(timezone='Europe/Istanbul'),
 valid_from date not null, valid_until date not null, check(valid_until>=valid_from)
);
create table public.sessions (
 id uuid primary key default gen_random_uuid(), group_term_id uuid not null references public.group_terms(id),
 schedule_rule_id uuid references public.schedule_rules(id), training_plan_id uuid references public.training_plans(id),
 starts_at timestamptz not null, ends_at timestamptz not null,
 status text not null default 'SCHEDULED' check(status in ('SCHEDULED','COMPLETED','CANCELLED')),
 created_by uuid not null default auth.uid() references public.profiles(id),
 created_at timestamptz not null default now(), check(ends_at>starts_at), unique(schedule_rule_id,starts_at)
);
create index sessions_time on public.sessions(group_term_id,starts_at);
create table public.session_coaches (
 session_id uuid not null references public.sessions(id), coach_id uuid not null references public.profiles(id),
 participation_status text not null default 'UNCONFIRMED'
 check(participation_status in ('UNCONFIRMED','ATTENDED','ABSENT','EXCUSED')),
 verified_by uuid references public.profiles(id), verified_at timestamptz,
 primary key(session_id,coach_id),
 check((participation_status='UNCONFIRMED' and verified_by is null and verified_at is null)
 or (participation_status<>'UNCONFIRMED' and verified_by is not null and verified_at is not null))
);
create index session_coach_lookup on public.session_coaches(coach_id,session_id);
create table public.session_athletes (
 session_id uuid not null references public.sessions(id), athlete_id uuid not null references public.athletes(id),
 enrollment_id uuid not null references public.enrollments(id), primary key(session_id,athlete_id)
);
create index session_athlete_lookup on public.session_athletes(athlete_id,session_id);
create table public.athlete_attendance (
 session_id uuid not null, athlete_id uuid not null,
 status text not null check(status in ('PRESENT','ABSENT','EXCUSED')),
 recorded_by uuid not null default auth.uid() references public.profiles(id),
 recorded_at timestamptz not null default now(), note varchar(500),
 primary key(session_id,athlete_id),
 foreign key(session_id,athlete_id) references public.session_athletes(session_id,athlete_id)
);
create table public.audit_logs (
 id bigint generated always as identity primary key,
 actor_id uuid, action text not null, entity_type text not null,
 entity_key jsonb not null, changed_fields text[] not null,
 created_at timestamptz not null default now()
);

-- All definer functions use qualified names and a fixed search_path.
create function private.has_role(wanted text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.user_roles r join public.profiles p on p.id=r.user_id
 where r.user_id=auth.uid() and r.role=wanted and p.is_active)
$$;
create function private.coaches_term(term uuid, on_date date default current_date) returns boolean
language sql stable security definer set search_path='' as $$
 select private.has_role('COACH') and exists(select 1 from public.coach_assignments a
 where a.coach_id=auth.uid() and a.group_term_id=term and on_date between a.starts_on and a.ends_on)
$$;
create function private.owns_session(lesson uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.has_role('COACH') and exists(select 1 from public.session_coaches c
 where c.session_id=lesson and c.coach_id=auth.uid())
$$;
create function private.sees_athlete(athlete uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.has_role('COACH') and (
 exists(select 1 from public.enrollments e where e.athlete_id=athlete
 and current_date between e.joined_on and coalesce(e.left_on,'infinity'::date)
 and private.coaches_term(e.group_term_id))
 or exists(select 1 from public.session_athletes a where a.athlete_id=athlete and private.owns_session(a.session_id)))
$$;

-- Serialize related writes on the term; prevents concurrent membership overlap
-- and changes that would move existing lessons/memberships out of the term.
create function private.validate_term_child() returns trigger language plpgsql security definer set search_path='' as $$
declare t public.group_terms; lesson public.sessions; member public.enrollments;
begin
 if tg_table_name in ('enrollments','coach_assignments','schedule_rules','sessions') then
  if tg_op='UPDATE' and new.group_term_id<>old.group_term_id then
   raise exception 'Term reassignment is not allowed' using errcode='23514';
  end if;
  select * into t from public.group_terms where id=new.group_term_id for update;
  if tg_table_name='enrollments' then
   if new.joined_on<t.start_date or coalesce(new.left_on,t.end_date)>t.end_date then
    raise exception 'Enrollment outside term' using errcode='23514'; end if;
   if exists(select 1 from public.enrollments e where e.group_term_id=new.group_term_id
    and e.athlete_id=new.athlete_id and e.id<>new.id
    and daterange(e.joined_on,coalesce(e.left_on,t.end_date),'[]') && daterange(new.joined_on,coalesce(new.left_on,t.end_date),'[]')) then
    raise exception 'Overlapping enrollment' using errcode='23514'; end if;
  elsif tg_table_name='coach_assignments' then
   if new.starts_on<t.start_date or new.ends_on>t.end_date then raise exception 'Assignment outside term' using errcode='23514'; end if;
   if not exists(select 1 from public.user_roles where user_id=new.coach_id and role='COACH') then
    raise exception 'Coach role required' using errcode='23514'; end if;
  elsif tg_table_name='schedule_rules' then
   if new.valid_from<t.start_date or new.valid_until>t.end_date then raise exception 'Schedule outside term' using errcode='23514'; end if;
  else
   if (new.starts_at at time zone 'Europe/Istanbul')::date<t.start_date
    or (new.ends_at at time zone 'Europe/Istanbul')::date>t.end_date then
    raise exception 'Lesson outside term' using errcode='23514'; end if;
   if new.training_plan_id is not null and not exists(select 1 from public.training_plans p
    where p.id=new.training_plan_id and (p.group_term_id is null or p.group_term_id=new.group_term_id)) then
    raise exception 'Plan belongs to another term' using errcode='23514'; end if;
   if new.schedule_rule_id is not null and not exists(select 1 from public.schedule_rules r
    where r.id=new.schedule_rule_id and r.group_term_id=new.group_term_id) then
    raise exception 'Rule belongs to another term' using errcode='23514'; end if;
   if tg_op='UPDATE' and (new.starts_at,new.ends_at) is distinct from (old.starts_at,old.ends_at)
    and (exists(select 1 from public.session_coaches where session_id=new.id)
      or exists(select 1 from public.session_athletes where session_id=new.id)) then
    raise exception 'Assigned lesson time is locked; cancel and create a replacement' using errcode='23514'; end if;
  end if;
 elsif tg_table_name='session_athletes' then
  select * into lesson from public.sessions where id=new.session_id for update;
  select * into member from public.enrollments where id=new.enrollment_id for update;
  if member.id is null or member.athlete_id<>new.athlete_id or member.group_term_id<>lesson.group_term_id
   or (lesson.starts_at at time zone 'Europe/Istanbul')::date not between member.joined_on and coalesce(member.left_on,'infinity'::date) then
   raise exception 'Invalid lesson membership' using errcode='23514'; end if;
 end if;
 return new;
end $$;
create trigger validate_enrollment before insert or update on public.enrollments for each row execute function private.validate_term_child();
create trigger validate_assignment before insert or update on public.coach_assignments for each row execute function private.validate_term_child();
create trigger validate_rule before insert or update on public.schedule_rules for each row execute function private.validate_term_child();
create trigger validate_session before insert or update on public.sessions for each row execute function private.validate_term_child();
create trigger validate_roster before insert or update on public.session_athletes for each row execute function private.validate_term_child();

create function private.validate_term_dates() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.enrollments where group_term_id=new.id and (joined_on<new.start_date or coalesce(left_on,old.end_date)>new.end_date))
 or exists(select 1 from public.sessions where group_term_id=new.id and ((starts_at at time zone 'Europe/Istanbul')::date<new.start_date or (ends_at at time zone 'Europe/Istanbul')::date>new.end_date))
 or exists(select 1 from public.coach_assignments where group_term_id=new.id and (starts_on<new.start_date or ends_on>new.end_date))
 or exists(select 1 from public.schedule_rules where group_term_id=new.id and (valid_from<new.start_date or valid_until>new.end_date)) then
 raise exception 'Existing records outside new term dates' using errcode='23514'; end if;
 return new;
end $$;
create trigger validate_term_dates before update on public.group_terms for each row execute function private.validate_term_dates();

create function private.validate_coach_lesson() returns trigger language plpgsql security definer set search_path='' as $$
declare lesson public.sessions;
begin
 -- Profile lock serializes overlapping assignments for the same coach.
 perform 1 from public.profiles where id=new.coach_id for update;
 select * into lesson from public.sessions where id=new.session_id for update;
 if not exists(select 1 from public.coach_assignments a join public.user_roles r on r.user_id=a.coach_id and r.role='COACH'
 where a.coach_id=new.coach_id and a.group_term_id=lesson.group_term_id
 and (lesson.starts_at at time zone 'Europe/Istanbul')::date between a.starts_on and a.ends_on) then
 raise exception 'Coach is not assigned to term' using errcode='23514'; end if;
 if lesson.status<>'CANCELLED' and exists(select 1 from public.session_coaches c join public.sessions s on s.id=c.session_id
 where c.coach_id=new.coach_id and c.session_id<>new.session_id and s.status<>'CANCELLED'
 and tstzrange(s.starts_at,s.ends_at,'[)') && tstzrange(lesson.starts_at,lesson.ends_at,'[)')) then
 raise exception 'Coach has overlapping lesson' using errcode='23514'; end if;
 if new.participation_status<>'UNCONFIRMED' then
  if not private.has_role('ADMIN') then raise exception 'Admin verification required' using errcode='42501'; end if;
  new.verified_by:=auth.uid(); new.verified_at:=now();
 else new.verified_by:=null; new.verified_at:=null;
 end if;
 return new;
end $$;
create trigger validate_coach_lesson before insert or update on public.session_coaches for each row execute function private.validate_coach_lesson();

create function private.stamp_attendance() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.sessions where id=new.session_id and (status='CANCELLED' or starts_at>now())) then
 raise exception 'Cannot mark cancelled or future lesson' using errcode='23514'; end if;
 new.recorded_by:=auth.uid(); new.recorded_at:=now(); return new;
end $$;
create trigger stamp_attendance before insert or update on public.athlete_attendance for each row execute function private.stamp_attendance();

-- Audit field names, not children's personal data or free-text notes.
create function private.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
declare row_data jsonb:=to_jsonb(new); old_data jsonb:=case when tg_op='UPDATE' then to_jsonb(old) else '{}'::jsonb end;
begin
 insert into public.audit_logs(actor_id,action,entity_type,entity_key,changed_fields)
 values(auth.uid(),tg_op,tg_table_name,
 jsonb_strip_nulls(jsonb_build_object('id',row_data->'id','session_id',row_data->'session_id','athlete_id',row_data->'athlete_id','coach_id',row_data->'coach_id','user_id',row_data->'user_id')),
 array(select key from jsonb_each(row_data) where value is distinct from old_data->key));
 return new;
end $$;

-- RLS is enforced for both HTTP API calls and direct Supabase client requests.
do $$ declare t text; begin
 foreach t in array array['profiles','user_roles','athletes','guardians','athlete_guardians','groups','group_terms','enrollments','coach_assignments','training_plans','schedule_rules','sessions','session_coaches','session_athletes','athlete_attendance','audit_logs'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 if t<>'audit_logs' then
 execute format('grant insert, update on public.%I to authenticated',t);
 execute format('create policy admin_select on public.%I for select to authenticated using (private.has_role(''ADMIN''))',t);
 execute format('create policy admin_insert on public.%I for insert to authenticated with check (private.has_role(''ADMIN''))',t);
 execute format('create policy admin_update on public.%I for update to authenticated using (private.has_role(''ADMIN'')) with check (private.has_role(''ADMIN''))',t);
 execute format('create trigger audit_change after insert or update on public.%I for each row execute function private.audit_change()',t);
 end if;
 end loop;
end $$;
create policy audit_admin on public.audit_logs for select to authenticated using(private.has_role('ADMIN'));
create policy own_profile on public.profiles for select to authenticated using(id=auth.uid() and is_active);
create policy own_roles on public.user_roles for select to authenticated using(user_id=auth.uid());
create policy coach_athletes on public.athletes for select to authenticated using(private.sees_athlete(id));
create policy coach_groups on public.groups for select to authenticated using(exists(select 1 from public.group_terms t where t.group_id=groups.id and private.coaches_term(t.id)));
create policy coach_terms on public.group_terms for select to authenticated using(private.coaches_term(id));
create policy coach_enrollments on public.enrollments for select to authenticated using(private.coaches_term(group_term_id));
create policy own_assignments on public.coach_assignments for select to authenticated using(coach_id=auth.uid() and private.has_role('COACH'));
create policy coach_plans_read on public.training_plans for select to authenticated using(private.has_role('COACH') and (group_term_id is null or private.coaches_term(group_term_id)));
create policy coach_plans_insert on public.training_plans for insert to authenticated with check(created_by=auth.uid() and private.coaches_term(group_term_id));
create policy coach_plans_update on public.training_plans for update to authenticated using(created_by=auth.uid() and private.coaches_term(group_term_id)) with check(created_by=auth.uid() and private.coaches_term(group_term_id));
create policy coach_rules on public.schedule_rules for select to authenticated using(private.coaches_term(group_term_id));
create policy coach_sessions on public.sessions for select to authenticated using(private.owns_session(id));
create policy coach_lesson_assignment on public.session_coaches for select to authenticated using(coach_id=auth.uid() and private.has_role('COACH'));
create policy coach_roster on public.session_athletes for select to authenticated using(private.owns_session(session_id));
create policy own_attendance on public.athlete_attendance for select to authenticated using(recorded_by=auth.uid() and private.has_role('COACH'));
create policy coach_attendance_insert on public.athlete_attendance for insert to authenticated with check(recorded_by=auth.uid() and private.owns_session(session_id));
create policy coach_attendance_update on public.athlete_attendance for update to authenticated using(recorded_by=auth.uid() and private.owns_session(session_id)) with check(recorded_by=auth.uid() and private.owns_session(session_id));

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.has_role(text), private.coaches_term(uuid,date), private.owns_session(uuid), private.sees_athlete(uuid) to authenticated;

-- Referential identity is immutable. Changes are explicit new records.
create function private.immutable_identity() returns trigger language plpgsql set search_path='' as $$
declare k text;
begin
 foreach k in array tg_argv loop
  if to_jsonb(new)->k is distinct from to_jsonb(old)->k then
   raise exception 'Identity field cannot change: %',k using errcode='23514';
  end if;
 end loop;
 return new;
end $$;
create trigger immutable_enrollment before update on public.enrollments for each row execute function private.immutable_identity('athlete_id','group_term_id');
create trigger immutable_roster before update on public.session_athletes for each row execute function private.immutable_identity('session_id','athlete_id','enrollment_id');
create trigger immutable_coach before update on public.session_coaches for each row execute function private.immutable_identity('session_id','coach_id');
create trigger immutable_attendance before update on public.athlete_attendance for each row execute function private.immutable_identity('session_id','athlete_id');
create trigger immutable_rule before update on public.schedule_rules for each row execute function private.immutable_identity('group_term_id');
create trigger immutable_plan before update on public.training_plans for each row execute function private.immutable_identity('group_term_id','created_by');
create trigger immutable_assignment before update on public.coach_assignments for each row execute function private.immutable_identity('group_term_id','coach_id');

create function private.lock_historical_ranges() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='enrollments' and exists(
  select 1 from public.session_athletes a join public.sessions s on s.id=a.session_id
  where a.enrollment_id=new.id and (s.starts_at at time zone 'Europe/Istanbul')::date not between new.joined_on and coalesce(new.left_on,'infinity'::date)
 ) then raise exception 'Membership change invalidates a lesson roster' using errcode='23514'; end if;
 if tg_table_name='coach_assignments' and exists(
  select 1 from public.session_coaches c join public.sessions s on s.id=c.session_id
  where c.coach_id=new.coach_id and s.group_term_id=new.group_term_id
  and (s.starts_at at time zone 'Europe/Istanbul')::date between old.starts_on and old.ends_on
  and (s.starts_at at time zone 'Europe/Istanbul')::date not between new.starts_on and new.ends_on
 ) then raise exception 'Assignment change invalidates a lesson' using errcode='23514'; end if;
 return new;
end $$;
create trigger lock_enrollment_history before update on public.enrollments for each row execute function private.lock_historical_ranges();
create trigger lock_assignment_history before update on public.coach_assignments for each row execute function private.lock_historical_ranges();

create function private.no_reopen_cancelled() returns trigger language plpgsql set search_path='' as $$
begin
 if old.status='CANCELLED' and new.status<>'CANCELLED' then
 raise exception 'Create a replacement for cancelled lessons' using errcode='23514'; end if;
 return new;
end $$;
create trigger no_reopen_cancelled before update on public.sessions for each row execute function private.no_reopen_cancelled();
revoke all on all functions in schema private from public, anon;

-- Invoker security preserves the caller's RLS. Aggregate each child separately
-- to avoid multiplying athlete counts by the number of coaches.
create function public.lesson_report(from_time timestamptz, until_time timestamptz)
returns table(session_id uuid, starts_at timestamptz, ends_at timestamptz, status text,
 expected bigint, recorded bigint, present bigint, absent bigint, excused bigint, coaches jsonb)
language sql stable security invoker set search_path='' as $$
 select s.id,s.starts_at,s.ends_at,s.status,
 (select count(*) from public.session_athletes r where r.session_id=s.id),
 (select count(*) from public.athlete_attendance a where a.session_id=s.id),
 (select count(*) from public.athlete_attendance a where a.session_id=s.id and a.status='PRESENT'),
 (select count(*) from public.athlete_attendance a where a.session_id=s.id and a.status='ABSENT'),
 (select count(*) from public.athlete_attendance a where a.session_id=s.id and a.status='EXCUSED'),
 coalesce((select jsonb_agg(jsonb_build_object('coach_id',c.coach_id,'participation_status',c.participation_status))
 from public.session_coaches c where c.session_id=s.id),'[]'::jsonb)
 from public.sessions s where s.starts_at>=from_time and s.starts_at<until_time order by s.starts_at,s.id
$$;
revoke all on function public.lesson_report(timestamptz,timestamptz) from public,anon;
grant execute on function public.lesson_report(timestamptz,timestamptz) to authenticated;
