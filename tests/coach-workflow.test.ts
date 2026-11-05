import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {coachProfileSchema,athleteRequestSchema,reviewRequestSchema,lessonBundleSchema} from '../src/lib/coach-workflow';
import {readImage} from '../src/lib/upload-image';
const id=(n:number)=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
test('workflow payloads reject identity spoofing, empty rejection and duplicate roster',()=>{
 assert.equal(coachProfileSchema.safeParse({display_name:'Test',phone:null,city:null,specialization:null,bio:null,avatar_path:null,is_active:true}).success,false);
 assert.equal(athleteRequestSchema.safeParse({group_term_id:id(4),first_name:'Ada',last_name:'Test',birth_date:null,joined_on:'2026-11-05',note:null,status:'APPROVED'}).success,false);
 assert.equal(reviewRequestSchema.safeParse({id:id(1),decision:'REJECTED',review_message:' '}).success,false);
 assert.equal(lessonBundleSchema.safeParse({group_term_id:id(4),coach_id:id(2),starts_at:'2026-11-05T10:00:00Z',ends_at:'2026-11-05T11:00:00Z',athlete_ids:[id(9),id(9)],training_plan_id:null,create_assignment:false}).success,false);
});
test('private avatar stream rejects oversized and unsupported data',async()=>{
 const large=await readImage(new Request('https://test.invalid',{method:'POST',body:new Uint8Array(11)}),10);assert.equal(large.response?.status,413);
 const bad=await readImage(new Request('https://test.invalid',{method:'POST',body:'<svg/>'}),100);assert.equal(bad.response?.status,415);
});
test('profile privacy, pending approvals and bundled lessons enforce PostgreSQL permissions',async t=>{
 const db=new PGlite();
 try{
 await db.exec(`create role anon nologin;create role authenticated nologin;
 create schema auth;create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
 create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,update,delete on storage.objects to authenticated;`);
 for(const f of (await readdir(new URL('../supabase/migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL('../supabase/migrations/'+f,import.meta.url),'utf8'));
 const as=async(n:number)=>db.exec(`reset role;select set_config('request.jwt.claim.sub','${id(n)}',false);set role authenticated;`);
 const count=async(table:string)=>Number((await db.query<{n:number}>(`select count(*) n from public.${table}`)).rows[0].n);
 await db.exec(`insert into auth.users values('${id(1)}'),('${id(2)}'),('${id(3)}');
 insert into public.profiles(id,display_name) values('${id(1)}','Admin'),('${id(2)}','Coach'),('${id(3)}','Peer');
 insert into public.user_roles values('${id(1)}','ADMIN'),('${id(2)}','COACH'),('${id(3)}','COACH');
 select set_config('request.jwt.claim.sub','${id(1)}',false);
 insert into public.groups(id,name) values('${id(4)}','Yüzme');
 insert into public.group_terms(id,group_id,name,start_date,end_date,status) values('${id(5)}','${id(4)}','Dönem',current_date-10,current_date+30,'ACTIVE');
 insert into public.coach_assignments(group_term_id,coach_id,starts_on,ends_on) values('${id(5)}','${id(2)}',current_date-10,current_date+30);
 insert into public.sessions(id,group_term_id,starts_at,ends_at) values('${id(6)}','${id(5)}',(current_date+1)::timestamp at time zone 'Europe/Istanbul'+interval '12 hours',(current_date+1)::timestamp at time zone 'Europe/Istanbul'+interval '13 hours');
 insert into public.session_coaches(session_id,coach_id) values('${id(6)}','${id(2)}');`);
 await as(2);
 await t.test('coach saves own display name and private details but cannot reactivate or change peer',async()=>{
  await db.query(`select public.save_my_coach_profile($1::jsonb)`,[JSON.stringify({display_name:'Yeni İsim',phone:'05551234567',city:'Alanya',bio:null,specialization:null,avatar_path:null})]);
  assert.equal((await db.query<{display_name:string}>(`select display_name from public.profiles where id='${id(2)}'`)).rows[0].display_name,'Yeni İsim');
  await assert.rejects(db.exec(`update public.profiles set is_active=false where id='${id(2)}'`),{code:'42501'});
  assert.equal((await db.query(`update public.profiles set display_name='Hack' where id='${id(3)}' returning id`)).rows.length,0);
  await as(3);assert.equal(await count('coach_profiles'),0);await as(2);
 });
 await t.test('avatars are private to their owner and profile rejects another path',async()=>{
  await db.exec(`insert into storage.objects(bucket_id,name) values('coach-avatars','${id(2)}/photo.png')`);
  await db.query(`select public.save_my_coach_profile($1::jsonb)`,[JSON.stringify({display_name:'Coach',avatar_path:id(2)+'/photo.png'})]);
  await assert.rejects(db.query(`select public.save_my_coach_profile($1::jsonb)`,[JSON.stringify({display_name:'Coach',avatar_path:id(3)+'/photo.png'})]),{code:'42501'});
  await as(3);assert.equal((await db.query(`select * from storage.objects where bucket_id='coach-avatars'`)).rows.length,0);
  await assert.rejects(db.exec(`insert into storage.objects(bucket_id,name) values('coach-avatars','${id(2)}/forged.png')`),{code:'42501'});await as(2);
 });
 async function request(name:string,lesson=true){return (await db.query<{id:string}>(`insert into public.athlete_requests(group_term_id,session_id,first_name,last_name,joined_on) values($1,$2,$3,'Test',current_date) returning id`,[id(5),lesson?id(6):null,name])).rows[0].id;}
 let pending='';
 await t.test('request creates no athlete, enrollment or roster and coach cannot approve or forge state',async()=>{
  pending=await request('Ada');assert.equal(await count('athletes'),0);assert.equal(await count('enrollments'),0);assert.equal(await count('session_athletes'),0);
  await assert.rejects(db.query(`select public.review_athlete_request($1,'APPROVED')`,[pending]),{code:'42501'});
  await assert.rejects(db.exec(`update public.athlete_requests set status='APPROVED'`),{code:'42501'});
  await assert.rejects(db.exec(`insert into public.athlete_requests(group_term_id,first_name,last_name,joined_on,status) values('${id(5)}','Ada','Test',current_date,'APPROVED')`),{code:'42501'});
  await as(3);assert.equal(await count('athlete_requests'),0);await assert.rejects(request('Foreign'),{code:'42501'});await as(2);
 });
 let athlete='';
 await t.test('admin approval atomically creates athlete, group membership and lesson roster, only once',async()=>{
  await as(1);athlete=(await db.query<{athlete:string}>(`select public.review_athlete_request($1,'APPROVED') athlete`,[pending])).rows[0].athlete;
  assert.equal(await count('athletes'),1);assert.equal(await count('enrollments'),1);assert.equal(await count('session_athletes'),1);
  const row=(await db.query<{status:string;reviewed_by:string}>(`select status,reviewed_by from public.athlete_requests where id=$1`,[pending])).rows[0];assert.equal(row.status,'APPROVED');assert.equal(row.reviewed_by,id(1));
  await assert.rejects(db.query(`select public.review_athlete_request($1,'APPROVED')`,[pending]),{code:'40001'});
 });
 await t.test('existing athlete can be linked without duplicate membership and rejected request creates nothing',async()=>{
  await as(2);const duplicate=await request('Ada duplicate');const rejected=await request('Rejected',false);await as(1);
  await db.query(`select public.review_athlete_request($1,'APPROVED',$2)`,[duplicate,athlete]);assert.equal(await count('athletes'),1);assert.equal(await count('session_athletes'),1);
  await assert.rejects(db.query(`select public.review_athlete_request($1,'REJECTED')`,[rejected]),{code:'23514'});
  await db.query(`select public.review_athlete_request($1,'REJECTED',null,'Bilgiler eksik')`,[rejected]);assert.equal(await count('athletes'),1);
 });
 await t.test('failed approval rolls back all writes and remains pending',async()=>{
  await as(2);const r=await request('Cancelled');await as(1);await db.exec(`update public.sessions set status='CANCELLED' where id='${id(6)}'`);
  await assert.rejects(db.query(`select public.review_athlete_request($1,'APPROVED')`,[r]),{code:'23514'});assert.equal(await count('athletes'),1);
  assert.equal((await db.query<{status:string}>(`select status from public.athlete_requests where id=$1`,[r])).rows[0].status,'PENDING');
 });
 await t.test('lesson bundle atomically assigns coach and roster; invalid roster leaves no orphan lesson or assignment',async()=>{
  const dates=(await db.query<{start:string;end:string}>(`select ((current_date+2)::timestamp at time zone 'Europe/Istanbul'+interval '12 hours')::text start,((current_date+2)::timestamp at time zone 'Europe/Istanbul'+interval '13 hours')::text "end"`)).rows[0];
  const payload={group_term_id:id(5),coach_id:id(3),starts_at:dates.start,ends_at:dates.end,athlete_ids:[id(99)],create_assignment:true};
  const before=await count('sessions'),assignments=await count('coach_assignments');
  await assert.rejects(db.query(`select * from public.create_lesson_bundle($1::jsonb)`,[JSON.stringify(payload)]),{code:'23514'});
  assert.equal(await count('sessions'),before);assert.equal(await count('coach_assignments'),assignments);
  payload.athlete_ids=[athlete];
  await assert.rejects(db.query(`select * from public.create_lesson_bundle($1::jsonb)`,[JSON.stringify({...payload,create_assignment:false})]),{code:'23514'});
  const created=(await db.query<{id:string}>(`select * from public.create_lesson_bundle($1::jsonb)`,[JSON.stringify(payload)])).rows[0];
  assert.equal(await count('sessions'),before+1);assert.equal(await count('coach_assignments'),assignments+1);
  assert.equal((await db.query(`select * from public.session_coaches where session_id=$1 and coach_id=$2`,[created.id,id(3)])).rows.length,1);
  const assignment=(await db.query<{single:boolean}>(`select starts_on=ends_on single from public.coach_assignments where coach_id=$1`,[id(3)])).rows[0];assert.equal(assignment.single,true);
  await as(2);await assert.rejects(db.query(`select * from public.create_lesson_bundle($1::jsonb)`,[JSON.stringify(payload)]),{code:'42501'});
 });
 }finally{await db.close();}
});
