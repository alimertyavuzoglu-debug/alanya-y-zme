import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const ids = {
 admin:'00000000-0000-4000-8000-000000000001', coach:'00000000-0000-4000-8000-000000000002', other:'00000000-0000-4000-8000-000000000003',
 athlete:'00000000-0000-4000-8000-000000000004', hidden:'00000000-0000-4000-8000-000000000005',
 group:'00000000-0000-4000-8000-000000000006', term:'00000000-0000-4000-8000-000000000007',
 enrollment:'00000000-0000-4000-8000-000000000008', lesson:'00000000-0000-4000-8000-000000000009',
};
test('PostgreSQL migration, data integrity, role isolation and attendance lifecycle', async (t) => {
 const db = new PGlite();
 try {
 await db.exec(`create role anon nologin; create role authenticated nologin;
 create schema storage;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;
 grant select,insert,update,delete on storage.objects to authenticated;
 grant usage on schema storage to authenticated;
 create schema auth; create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
 for(const name of (await readdir(new URL('../supabase/migrations/',import.meta.url))).filter(n=>n.endsWith('.sql')).sort()) {
  await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
 }
 const run = async (sql: string) => db.exec(sql);
 const as = async (who: keyof typeof ids) => {
  await run(`reset role; select set_config('request.jwt.claim.sub','${ids[who]}',false); set role authenticated;`);
 };
 const count = async (table: string) => Number((await db.query<{n:string}>(`select count(*) n from public.${table}`)).rows[0].n);
 await run(`insert into auth.users values ('${ids.admin}'),('${ids.coach}'),('${ids.other}');
 insert into public.profiles(id,display_name) values ('${ids.admin}','Admin'),('${ids.coach}','Coach'),('${ids.other}','Other');
 insert into public.user_roles values ('${ids.admin}','ADMIN'),('${ids.coach}','COACH'),('${ids.other}','COACH');`);
 await as('admin');
 await run(`insert into public.groups(id,name) values ('${ids.group}','Yüzme');
 insert into public.group_terms(id,group_id,name,start_date,end_date,status) values ('${ids.term}','${ids.group}','Dönem',current_date-30,current_date+30,'ACTIVE');
 insert into public.athletes(id,first_name,last_name) values ('${ids.athlete}','Ada','Örnek'),('${ids.hidden}','Ege','Gizli');
 insert into public.enrollments(id,group_term_id,athlete_id,joined_on) values ('${ids.enrollment}','${ids.term}','${ids.athlete}',current_date-30);
 insert into public.coach_assignments(group_term_id,coach_id,starts_on,ends_on) values ('${ids.term}','${ids.coach}',current_date-30,current_date+30);
 insert into public.sessions(id,group_term_id,starts_at,ends_at) values ('${ids.lesson}','${ids.term}',now()-interval '2 hours',now()-interval '1 hour');
 insert into public.session_coaches(session_id,coach_id) values ('${ids.lesson}','${ids.coach}');
 insert into public.session_athletes values ('${ids.lesson}','${ids.athlete}','${ids.enrollment}');`);
 await t.test('admin can edit enrollment and assignment dates without changing history', async()=> {
  await run(`update public.enrollments set joined_on=current_date-29 where id='${ids.enrollment}'`);
  await run(`update public.coach_assignments set starts_on=current_date-29 where coach_id='${ids.coach}'`);
 });
 await t.test('rejects overlapping membership', async()=> {
  await assert.rejects(run(`insert into public.enrollments(group_term_id,athlete_id,joined_on) values ('${ids.term}','${ids.athlete}',current_date)`),/Overlapping/);
 });
 await t.test('rejects term shrink that excludes records', async()=> {
  await assert.rejects(run(`update public.group_terms set start_date=current_date where id='${ids.term}'`),/outside new term/);
 });
 await t.test('rejects inconsistent lesson roster', async()=> {
  await assert.rejects(run(`insert into public.session_athletes values ('${ids.lesson}','${ids.hidden}','${ids.enrollment}')`),/Invalid lesson membership/);
 });
 await t.test('rejects overlapping coach lesson', async()=> {
  const result = await db.query<{id:string}>(`insert into public.sessions(group_term_id,starts_at,ends_at) values ('${ids.term}',now()-interval '90 minutes',now()-interval '30 minutes') returning id`);
  await assert.rejects(run(`insert into public.session_coaches(session_id,coach_id) values ('${result.rows[0].id}','${ids.coach}')`),/overlapping lesson/);
 });
 await t.test('admin publishes website content with monotonic revision',async()=>{
  await run(`insert into storage.objects(bucket_id,name) values ('site-media','allowed.png')`);
  await assert.rejects(run(`insert into storage.objects(bucket_id,name) values ('unrelated-bucket','denied.png')`),/row-level security/);
  await run(`update public.site_content set content='{}'::jsonb where key='homepage' and revision=0`);
  const rows=await db.query<{revision:number}>(`select revision from public.site_content`);assert.equal(rows.rows[0].revision,1);
  const stale=await db.query(`update public.site_content set content='{}'::jsonb where revision=0 returning revision`);assert.equal(stale.rows.length,0);
 });
 await as('coach');
 await t.test('coach cannot publish content or upload website media',async()=>{
  const rows=await db.query(`update public.site_content set content='{}'::jsonb returning revision`);assert.equal(rows.rows.length,0);
  await assert.rejects(run(`insert into storage.objects(bucket_id,name) values ('site-media','denied.png')`),/row-level security/);
 });
 await t.test('coach sees own athletes, term, group and lesson only', async()=> {
  assert.equal(await count('athletes'),1); assert.equal(await count('sessions'),1);
  assert.equal(await count('groups'),1); assert.equal(await count('group_terms'),1);
 });
 await t.test('coach cannot escalate role or create general plan', async()=> {
  await assert.rejects(run(`insert into public.user_roles values ('${ids.coach}','ADMIN')`),/row-level security/);
  await assert.rejects(run(`insert into public.training_plans(title,content) values ('Genel','Plan')`),/row-level security/);
 });
 await t.test('coach may create own group plan', async()=> {
  await run(`insert into public.training_plans(group_term_id,title,content) values ('${ids.term}','Teknik','Serbest stil')`);
 });
 await t.test('coach cannot confirm own participation', async()=> {
  const result=await db.query(`update public.session_coaches set participation_status='ATTENDED' where session_id='${ids.lesson}' returning *`);
  assert.equal(result.rows.length,0);
 });
 await t.test('attendance starts empty and writer identity is stamped', async()=> {
  assert.equal(await count('athlete_attendance'),0);
  await run(`insert into public.athlete_attendance(session_id,athlete_id,status,recorded_by) values ('${ids.lesson}','${ids.athlete}','PRESENT','${ids.admin}')`);
  const row=(await db.query<{recorded_by:string}>(`select recorded_by from public.athlete_attendance`)).rows[0];
  assert.equal(row.recorded_by,ids.coach);
  await run(`update public.athlete_attendance set status='EXCUSED' where session_id='${ids.lesson}'`);
  await assert.rejects(run(`insert into public.athlete_attendance(session_id,athlete_id,status) values ('${ids.lesson}','${ids.athlete}','ABSENT')`),/duplicate key/);
 });
 await t.test('coach bulk attendance is atomic and rejects duplicate athletes',async()=>{
  const entry={athlete_id:ids.athlete,status:'PRESENT',note:null};
  await assert.rejects(db.query(`select * from public.record_my_attendance($1,$2::jsonb)`,[ids.lesson,JSON.stringify([entry,{athlete_id:ids.hidden,status:'ABSENT'}])]),/foreign key/);
  assert.equal((await db.query<{status:string}>(`select status from public.athlete_attendance`)).rows[0].status,'EXCUSED');
  await assert.rejects(db.query(`select * from public.record_my_attendance($1,$2::jsonb)`,[ids.lesson,JSON.stringify([entry,entry])]),/Duplicate athlete/);
  const result=await db.query<{recorded_by:string}>(`select * from public.record_my_attendance($1,$2::jsonb)`,[ids.lesson,JSON.stringify([entry])]);
  assert.equal(result.rows.length,1);assert.equal(result.rows[0].recorded_by,ids.coach);
 });
 await as('other');
 await t.test('unassigned coach cannot read or write another coach records', async()=> {
  await assert.rejects(db.query(`select * from public.record_my_attendance($1,$2::jsonb)`,[ids.lesson,JSON.stringify([{athlete_id:ids.athlete,status:'ABSENT'}])]),/Own coach lesson required/);
  for (const table of ['athletes','sessions','groups','group_terms','athlete_attendance']) assert.equal(await count(table),0,table);
  await assert.rejects(run(`insert into public.athlete_attendance(session_id,athlete_id,status) values ('${ids.lesson}','${ids.athlete}','ABSENT')`),/row-level security/);
 });
 await as('admin');
 await t.test('admin sees all and can verify coach participation', async()=> {
  assert.equal(await count('athletes'),2);
  await run(`update public.session_coaches set participation_status='ATTENDED' where session_id='${ids.lesson}'`);
  const row=(await db.query<{verified_by:string}>(`select verified_by from public.session_coaches`)).rows[0];
  assert.equal(row.verified_by,ids.admin);
  await run(`insert into public.coach_assignments(group_term_id,coach_id,starts_on,ends_on) values ('${ids.term}','${ids.other}',current_date-30,current_date+30);
  insert into public.session_coaches(session_id,coach_id) values ('${ids.lesson}','${ids.other}');`);
  const report=(await db.query<{expected:number,recorded:number,coaches:unknown[]}>(`select * from public.lesson_report(now()-interval '1 day',now()+interval '1 day') where session_id='${ids.lesson}'`)).rows[0];
  assert.equal(Number(report.expected),1);
  assert.equal(Number(report.recorded),1);
  assert.equal(report.coaches.length,2);
  assert.ok(await count('audit_logs')>0);
  await assert.rejects(run(`delete from public.audit_logs`),/permission denied/);
 });
 await as('other');
 await t.test('assigned peer cannot overwrite another coach attendance',async()=>{
  await assert.rejects(db.query(`select * from public.record_my_attendance($1,$2::jsonb)`,[ids.lesson,JSON.stringify([{athlete_id:ids.athlete,status:'ABSENT'}])]),{code:'42501'});
  assert.equal(await count('athlete_attendance'),0);
 });
 await as('admin');
 await t.test('coach RPC preserves ownership even for dual admin-coach role',async()=>{
  await run(`insert into public.user_roles values ('${ids.admin}','COACH');
   insert into public.coach_assignments(group_term_id,coach_id,starts_on,ends_on) values ('${ids.term}','${ids.admin}',current_date-30,current_date+30);
   insert into public.session_coaches(session_id,coach_id) values ('${ids.lesson}','${ids.admin}');`);
  await assert.rejects(db.query(`select * from public.record_my_attendance($1,$2::jsonb)`,[ids.lesson,JSON.stringify([{athlete_id:ids.athlete,status:'ABSENT'}])]),{code:'42501'});
  assert.equal((await db.query<{recorded_by:string}>(`select recorded_by from public.athlete_attendance`)).rows[0].recorded_by,ids.coach);
 });
 await t.test('cancelled lessons cannot receive attendance or reopen',async()=> {
  await run(`update public.sessions set status='CANCELLED' where id='${ids.lesson}'`);
  await assert.rejects(run(`update public.athlete_attendance set status='ABSENT' where session_id='${ids.lesson}'`),/cancelled or future/);
  await assert.rejects(run(`update public.sessions set status='SCHEDULED' where id='${ids.lesson}'`),/replacement/);
 });
 await t.test('coach can read own historical lesson metadata but peers cannot',async()=>{
  await run(`insert into public.groups(id,name) values ('00000000-0000-4000-8000-000000000010','Geçmiş grup');
  insert into public.group_terms(id,group_id,name,start_date,end_date) values ('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000010','Geçmiş dönem',current_date-70,current_date-40);
  insert into public.coach_assignments(group_term_id,coach_id,starts_on,ends_on) values ('00000000-0000-4000-8000-000000000011','${ids.coach}',current_date-70,current_date-40);
  insert into public.sessions(id,group_term_id,starts_at,ends_at) values ('00000000-0000-4000-8000-000000000012','00000000-0000-4000-8000-000000000011',((current_date-50)::timestamp at time zone 'Europe/Istanbul')+interval '12 hours',((current_date-50)::timestamp at time zone 'Europe/Istanbul')+interval '13 hours');
  insert into public.session_coaches(session_id,coach_id) values ('00000000-0000-4000-8000-000000000012','${ids.coach}');`);
  await as('coach');
  assert.equal((await db.query(`select * from public.group_terms where id='00000000-0000-4000-8000-000000000011'`)).rows.length,1);
  assert.equal((await db.query(`select * from public.groups where id='00000000-0000-4000-8000-000000000010'`)).rows.length,1);
  await as('other');assert.equal((await db.query(`select * from public.groups where id='00000000-0000-4000-8000-000000000010'`)).rows.length,0);
  await as('admin');
 });
 await t.test('coach term permission uses Istanbul date regardless of database timezone',async()=>{
  await run(`insert into public.group_terms(id,group_id,name,start_date,end_date) values ('00000000-0000-4000-8000-000000000013','${ids.group}','Günlük',(now() at time zone 'Europe/Istanbul')::date,(now() at time zone 'Europe/Istanbul')::date);
  insert into public.coach_assignments(group_term_id,coach_id,starts_on,ends_on) values ('00000000-0000-4000-8000-000000000013','${ids.coach}',(now() at time zone 'Europe/Istanbul')::date,(now() at time zone 'Europe/Istanbul')::date);`);
  await as('coach');for(const zone of ['Pacific/Kiritimati','America/Adak']){await run(`set time zone '${zone}'`);assert.equal((await db.query<{ok:boolean}>(`select private.coaches_term('00000000-0000-4000-8000-000000000013') ok`)).rows[0].ok,true);}
  await run(`set time zone 'UTC'`);
 });
 await run(`reset role; update public.profiles set is_active=false where id='${ids.coach}'`);
 await as('coach');
 await t.test('disabled account loses access',async()=> {
  assert.equal(await count('athletes'),0); assert.equal(await count('sessions'),0);
 });
 await run(`reset role; set role anon`);
 await t.test('anonymous visitors can read published content but cannot update it',async()=>{
  assert.equal((await db.query(`select content from public.site_content where key='homepage'`)).rows.length,1);
  await assert.rejects(run(`update public.site_content set content='{}'::jsonb`),/permission denied/);
 });
 await t.test('anonymous visitors cannot read athlete data',async()=> {
  await assert.rejects(run('select * from public.athletes'),/permission denied/);
 });
 } finally { await db.close(); }
});
