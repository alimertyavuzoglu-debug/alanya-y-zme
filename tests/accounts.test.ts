import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {accountInvitationSchema,accountUpdateSchema,accountRemovalSchema} from '../src/lib/accounts';
const id=(n:number)=>`40000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const hash=(n:number)=>n.toString(16).padStart(64,'0');
test('account API schemas bound explicit roles and reject extra identity/permission fields',()=>{
 assert.equal(accountInvitationSchema.parse({email:' Admin@Example.com ',display_name:' Admin ',role:'ADMIN'}).email,'admin@example.com');
 for(const roles of [[],['OWNER'],['ADMIN','ADMIN'],['ADMIN','COACH','ADMIN']])assert.equal(accountUpdateSchema.safeParse({id:id(1),display_name:'User',is_active:true,roles}).success,false);
 assert.equal(accountUpdateSchema.safeParse({id:id(1),display_name:'User',is_active:true,roles:['ADMIN','COACH']}).success,true);
 assert.equal(accountRemovalSchema.safeParse({id:id(1),email:'other@example.com'}).success,false);
 assert.equal(accountInvitationSchema.safeParse({email:'user@example.com',display_name:'User',role:'ADMIN',created_by:id(2)}).success,false);
});
test('account management preserves history and enforces administrator boundaries in PostgreSQL',async t=>{
 const db=new PGlite();try{
 await db.exec(`create role anon nologin;create role authenticated nologin;
 create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb,created_at timestamptz default now());
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
 create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,update,delete on storage.objects to authenticated;`);
 for(const file of (await readdir(new URL('../supabase/migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
 const as=async(n:number)=>db.exec(`reset role;select set_config('request.jwt.claim.sub','${id(n)}',false);set role authenticated;`);
 const owner=async()=>db.exec('reset role');
 const update=async(n:number,roles:string[],active=true,name='Account '+n)=>db.query('select public.update_club_account($1,$2,$3::text[],$4)',[id(n),name,'{'+roles.join(',')+'}',active]);
 const remove=async(n:number)=>db.query('select public.remove_club_account($1)',[id(n)]);
 const invite=async(n:number,email:string,role='ADMIN')=>(await db.query<{id:string}>('select public.create_account_invitation($1,$2,$3,$4) id',[email,'Invited user',hash(n),role])).rows[0].id;
 const accept=async(n:number)=>db.query('select public.accept_coach_invitation($1)',[hash(n)]);
 const roles=async(n:number)=>(await db.query<{role:string}>('select role from public.user_roles where user_id=$1 order by role',[id(n)])).rows.map(r=>r.role);
 await db.exec(`insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
 ('${id(1)}','admin1@example.com',now(),'{}'),('${id(2)}','admin2@example.com',now(),'{}'),('${id(3)}','coach@example.com',now(),'{}'),
 ('${id(4)}','existing@example.com',now(),'{}'),('${id(5)}','unverified@example.com',null,'{}'),('${id(6)}','newadmin@example.com',null,'{}'),
 ('${id(7)}','newcoach@example.com',now(),'{"role":"ADMIN"}'),('${id(8)}','inactive@example.com',now(),'{}'),
 ('${id(9)}','expired@example.com',now(),'{}'),('${id(10)}','issuer-revoked@example.com',now(),'{}'),('${id(11)}','replace@example.com',now(),'{}');
 insert into public.profiles(id,display_name,is_active) values('${id(1)}','First admin',true),('${id(2)}','Second admin',true),('${id(3)}','Historical coach',true),('${id(8)}','Disabled user',false);
 insert into public.user_roles values('${id(1)}','ADMIN'),('${id(2)}','ADMIN'),('${id(3)}','COACH');`);
 await t.test('coach and anonymous callers cannot list emails, grant roles, invite admins or remove accounts',async()=>{
  await db.exec('set role anon');await assert.rejects(db.query('select * from public.list_club_accounts(0)'),{code:'42501'});
  await as(3);for(const action of [()=>db.query('select * from public.list_club_accounts(0)'),()=>update(3,['ADMIN']),()=>remove(2),()=>invite(100,'attacker@example.com')])await assert.rejects(action,{code:'42501'});
  await assert.rejects(db.exec(`insert into public.user_roles values('${id(3)}','ADMIN')`),{code:'42501'});
  assert.deepEqual(await roles(3),['COACH']);
 });
 await t.test('administrator directory exposes only bounded account fields and includes unassigned Auth accounts',async()=>{
  await as(1);const users=(await db.query<Record<string,unknown>>('select * from public.list_club_accounts(0)')).rows;assert.equal(users.length,11);assert.ok(users.some(r=>r.email==='existing@example.com'&&r.has_profile===false));assert.deepEqual(Object.keys(users[0]).sort(),['id','email','display_name','is_active','roles','email_verified','has_profile','created_at'].sort());await assert.rejects(db.query('select * from public.list_club_accounts(-1)'),{code:'23514'});
 });
 await t.test('verified existing account gets selected roles without changing Auth identity; unverified and invalid roles fail atomically',async()=>{
  await update(4,['ADMIN','COACH']);assert.deepEqual(await roles(4),['ADMIN','COACH']);await assert.rejects(update(5,['ADMIN']),{code:'23514'});assert.deepEqual(await roles(5),[]);await assert.rejects(update(3,['ADMIN','ADMIN']),{code:'23514'});await assert.rejects(db.exec(`select public.update_club_account('${id(3)}','Invalid',array['ADMIN',null],true)`),{code:'23514'});assert.deepEqual(await roles(3),['COACH']);
 });
 await t.test('own administrator access is protected through RPC and direct role/profile updates',async()=>{
  await assert.rejects(update(1,['COACH']),{code:'23514'});await assert.rejects(update(1,['ADMIN'],false),{code:'23514'});await assert.rejects(remove(1),{code:'23514'});
  await assert.rejects(db.exec(`update public.user_roles set role='COACH' where user_id='${id(1)}' and role='ADMIN'`),{code:'23514'});await assert.rejects(db.exec(`update public.profiles set is_active=false where id='${id(1)}'`),{code:'23514'});assert.deepEqual(await roles(1),['ADMIN']);
 });
 await t.test('administrators can revoke another administrator and the stale session immediately loses management access',async()=>{
  await update(2,['COACH']);await as(2);await assert.rejects(db.query('select * from public.list_club_accounts(0)'),{code:'42501'});await assert.rejects(update(1,['COACH']),{code:'42501'});await as(1);await update(2,['ADMIN']);
 });
 await owner();await db.exec(`select set_config('request.jwt.claim.sub','${id(3)}',false);
 insert into public.groups(id,name,sport) values('${id(20)}','Swimming','SWIMMING');
 insert into public.group_terms(id,group_id,name,start_date,end_date,status) values('${id(21)}','${id(20)}','Term','2026-11-01','2026-11-30','ACTIVE');
 insert into public.coach_assignments(group_term_id,coach_id,starts_on,ends_on) values('${id(21)}','${id(3)}','2026-11-01','2026-11-30');
 insert into public.sessions(id,group_term_id,starts_at,ends_at,status) values('${id(22)}','${id(21)}','2026-11-06 10:00+03','2026-11-06 11:00+03','COMPLETED');
 insert into public.session_coaches(session_id,coach_id) values('${id(22)}','${id(3)}');
 insert into public.athletes(id,first_name,last_name) values('${id(23)}','Ada','Test');
 insert into public.enrollments(id,athlete_id,group_term_id,joined_on) values('${id(24)}','${id(23)}','${id(21)}','2026-11-01');
 insert into public.session_athletes(session_id,athlete_id,enrollment_id) values('${id(22)}','${id(23)}','${id(24)}');
 insert into public.athlete_attendance(session_id,athlete_id,status) values('${id(22)}','${id(23)}','PRESENT');
 insert into public.coach_invitations(email,display_name,token_hash,created_by,invite_role) values('coach@example.com','Legacy pending','${hash(200)}','${id(1)}','COACH'),('owned@example.com','Issuer pending','${hash(201)}','${id(3)}','ADMIN');`);
 await t.test('removing access revokes roles and pending links but retains lessons, attendance, Auth and profile identity',async()=>{
  await as(1);await remove(3);assert.deepEqual(await roles(3),[]);assert.equal((await db.query<{is_active:boolean}>('select is_active from public.profiles where id=$1',[id(3)])).rows[0].is_active,false);
  assert.equal((await db.query('select * from public.session_coaches where coach_id=$1',[id(3)])).rows.length,1);assert.equal((await db.query('select * from public.athlete_attendance where recorded_by=$1',[id(3)])).rows.length,1);
  const revoked=(await db.query<{status:string}>('select status from public.coach_invitations where email in($1,$2)',['coach@example.com','owned@example.com'])).rows;assert.ok(revoked.every(r=>r.status==='REVOKED'));
  await as(3);assert.equal((await db.query('select * from public.sessions')).rows.length,0);await assert.rejects(db.query('select * from public.list_club_accounts(0)'),{code:'42501'});
  await as(1);assert.ok((await db.query('select * from public.audit_logs where action=$1 and entity_type=$2',['DELETE','user_roles'])).rows.length>0);await remove(3);
 });
 await t.test('removing an unassigned account closes access without deleting its identity; restoring needs an explicit administrator role choice',async()=>{
  await remove(5);await owner();assert.equal((await db.query('select id from auth.users where id=$1',[id(5)])).rows.length,1);await as(1);await update(3,['COACH'],true,'Historical coach');assert.deepEqual(await roles(3),['COACH']);
 });
 let administratorInvite='';
 await t.test('administrator invitations bind the exact email and require confirmation before assigning their stored role',async()=>{
  administratorInvite=await invite(300,'newadmin@example.com');await db.exec('set role anon');const lookup=(await db.query<{invite_role:string}>('select * from public.lookup_account_invitation($1)',[hash(300)])).rows;assert.equal(lookup[0].invite_role,'ADMIN');await as(7);await assert.rejects(accept(300),{code:'42501'});await as(6);await assert.rejects(accept(300),{code:'42501'});await owner();await db.exec(`update auth.users set email_confirmed_at=now() where id='${id(6)}'`);await as(6);await accept(300);await accept(300);assert.deepEqual(await roles(6),['ADMIN']);assert.ok((await db.query('select * from public.list_club_accounts(0)')).rows.length>0);
 });
 await t.test('client metadata cannot turn a coach invitation into an administrator invitation',async()=>{
  await as(1);await invite(301,'newcoach@example.com','COACH');await as(7);await accept(301);assert.deepEqual(await roles(7),['COACH']);
 });
 await t.test('accepted invitation replay cannot restore a subsequently removed role',async()=>{
  await as(1);await update(6,['COACH']);await as(6);await accept(300);assert.deepEqual(await roles(6),['COACH']);await as(1);await remove(6);await as(6);await assert.rejects(accept(300),{code:'42501'});
 });
 await t.test('revoked issuer, expired token and role-changing replacement cannot grant stale permissions',async()=>{
  await as(2);await invite(310,'issuer-revoked@example.com');await as(1);await update(2,['COACH']);await as(10);await assert.rejects(accept(310),{code:'42501'});assert.deepEqual(await roles(10),[]);
  await as(1);const expired=await invite(311,'expired@example.com');await owner();await db.query('update public.coach_invitations set expires_at=now()-interval \'1 hour\' where id=$1',[expired]);await as(9);await assert.rejects(accept(311),{code:'23514'});
  await as(1);await invite(312,'replace@example.com','ADMIN');await invite(313,'replace@example.com','COACH');await as(11);await assert.rejects(accept(312),{code:'23514'});await accept(313);assert.deepEqual(await roles(11),['COACH']);
 });
 await t.test('explicit account role updates invalidate an older pending administrator invitation',async()=>{
  await as(1);await invite(320,'expired@example.com','ADMIN');await update(9,['COACH']);await as(9);await assert.rejects(accept(320),{code:'23514'});assert.deepEqual(await roles(9),['COACH']);
 });
 await t.test('last remaining administrator cannot lock themselves out; directory and hashes remain private to other roles',async()=>{
  await as(1);await update(4,['COACH']);await assert.rejects(remove(1),{code:'23514'});await assert.rejects(update(1,['COACH']),{code:'23514'});assert.deepEqual(await roles(1),['ADMIN']);await as(3);assert.equal((await db.query('select invite_role from public.coach_invitations')).rows.length,0);await assert.rejects(db.query('select token_hash from public.coach_invitations'),{code:'42501'});
 });
 }finally{await db.close();}
});
