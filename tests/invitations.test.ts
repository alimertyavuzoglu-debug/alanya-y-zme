import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {coachAccountSchema,invitationReturnPath,invitationSchema,invitationSessionSchema,inviteTokenSchema} from '../src/lib/invitations';
const id=(n:number)=>`20000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const hash=(n:number)=>n.toString(16).padStart(64,'0');
test('invitations accept bounded coach data and reject role injection and unsafe callback paths',()=>{
 assert.deepEqual(invitationSchema.parse({email:' Coach@Example.COM ',display_name:' Coach '}),{email:'coach@example.com',display_name:'Coach'});
 assert.equal(invitationSchema.safeParse({email:'test@example.com',display_name:'Coach',role:'ADMIN'}).success,false);
 assert.equal(coachAccountSchema.safeParse({id:id(1),display_name:'Coach',is_active:true,role:'ADMIN'}).success,false);
 assert.equal(inviteTokenSchema.safeParse('too-short').success,false);
 assert.equal(invitationSessionSchema.safeParse({token:hash(1),action:'signup',password:'short'}).success,false);
 assert.equal(invitationReturnPath('/invite/'+hash(1)),'/invite/'+hash(1));
 for(const path of ['https://evil.example','//evil.example','/admin','/invite/'+hash(1)+'?next=//evil.example',null])assert.equal(invitationReturnPath(path),'/login');
});
test('coach invitations enforce verified email, single use, revocation and admin management in PostgreSQL',async t=>{
 const db=new PGlite();
 try{
 await db.exec(`create role anon nologin;create role authenticated nologin;
 create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
 create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,update,delete on storage.objects to authenticated;`);
 for(const f of (await readdir(new URL('../supabase/migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL('../supabase/migrations/'+f,import.meta.url),'utf8'));
 const as=async(n:number)=>db.exec(`reset role;select set_config('request.jwt.claim.sub','${id(n)}',false);set role authenticated;`);
 const create=async(n:number,email='new@example.com')=>(await db.query<{id:string}>(`select public.create_coach_invitation($1,'New Coach',$2) id`,[email,hash(n)])).rows[0].id;
 const accept=async(n:number)=>db.query(`select public.accept_coach_invitation($1)`,[hash(n)]);
 const lookup=async(n:number)=>db.query(`select * from public.lookup_coach_invitation($1)`,[hash(n)]);
 await db.exec(`insert into auth.users values('${id(1)}','admin@example.com',now(),'{}'),('${id(2)}','coach@example.com',now(),'{}'),('${id(3)}','new@example.com',null,'{"role":"ADMIN"}'),('${id(4)}','stranger@example.com',now(),'{}'),('${id(5)}','existing@example.com',now(),'{}');
 insert into public.profiles(id,display_name) values('${id(1)}','Admin'),('${id(2)}','Coach'),('${id(5)}','Existing profile');
 insert into public.user_roles values('${id(1)}','ADMIN'),('${id(2)}','COACH');`);
 let invitation='';
 await t.test('only admin creates invites and even admin HTTP reads cannot extract stored hashes',async()=>{
  await as(2);await assert.rejects(create(1),{code:'42501'});
  await as(1);invitation=await create(1,' NEW@example.com ');
  assert.equal((await db.query(`select id,email from public.coach_invitations`)).rows.length,1);
  await assert.rejects(db.query(`select token_hash from public.coach_invitations`),{code:'42501'});
  await as(2);assert.equal((await db.query(`select id from public.coach_invitations`)).rows.length,0);
 });
 await t.test('anonymous token lookup is narrow and anonymous cannot redeem or list accounts',async()=>{
  await db.exec(`reset role;select set_config('request.jwt.claim.sub','',false);set role anon;`);
  const info=(await lookup(1)).rows[0] as Record<string,unknown>;assert.equal(info.email,'new@example.com');assert.equal('token_hash' in info,false);assert.equal((await lookup(900)).rows.length,0);
  await assert.rejects(db.query(`select email from public.coach_invitations`),{code:'42501'});
  await assert.rejects(accept(1),{code:'42501'});
 });
 await t.test('neither wrong email nor unverified recipient can redeem; metadata cannot grant a role',async()=>{
  await as(4);await assert.rejects(accept(1),{code:'42501'});
  await as(3);await assert.rejects(accept(1),{code:'42501'});
  assert.equal((await db.query(`select role from public.user_roles where user_id='${id(3)}'`)).rows.length,0);
 });
 await t.test('verified recipient gains only COACH and profile atomically; retry does not duplicate',async()=>{
  await db.exec(`reset role;update auth.users set email_confirmed_at=now() where id='${id(3)}'`);await as(3);
  await accept(1);await accept(1);
  assert.deepEqual((await db.query<{role:string}>(`select role from public.user_roles where user_id='${id(3)}'`)).rows.map(r=>r.role),['COACH']);
  assert.equal((await db.query<{display_name:string}>(`select display_name from public.profiles where id='${id(3)}'`)).rows[0].display_name,'New Coach');
  await as(1);assert.equal((await db.query<{status:string}>(`select status from public.coach_invitations where id=$1`,[invitation])).rows[0].status,'ACCEPTED');
  await assert.rejects(create(2),{code:'23505'});
  await assert.rejects(db.query(`select public.revoke_coach_invitation($1)`,[invitation]),{code:'40001'});
 });
 await t.test('replacement revokes previous token and revocation is admin only',async()=>{
  await create(3,'stranger@example.com');const replacement=await create(4,'stranger@example.com');assert.equal((await lookup(3)).rows.length,0);
  await as(4);await assert.rejects(accept(3),{code:'23514'});
  await assert.rejects(db.query(`select public.revoke_coach_invitation($1)`,[replacement]),{code:'42501'});
  await as(1);await db.query(`select public.revoke_coach_invitation($1)`,[replacement]);await as(4);await assert.rejects(accept(4),{code:'23514'});
 });
 await t.test('expired invitation cannot provision any profile or role',async()=>{
  await as(1);await create(5,'stranger@example.com');await db.exec(`reset role;update public.coach_invitations set expires_at=now()-interval '1 hour' where token_hash='${hash(5)}'`);
  await as(4);assert.equal((await lookup(5)).rows.length,0);await assert.rejects(accept(5),{code:'23514'});
  assert.equal((await db.query(`select role from public.user_roles where user_id='${id(4)}'`)).rows.length,0);
 });
 await t.test('existing unassigned account can redeem without overwriting profile',async()=>{
  await as(1);await create(6,'existing@example.com');await as(5);await accept(6);
  assert.equal((await db.query<{display_name:string}>(`select display_name from public.profiles where id='${id(5)}'`)).rows[0].display_name,'Existing profile');
 });
 await t.test('admin disables and reactivates coach without deleting history; coach cannot reactivate himself',async()=>{
  await as(2);await assert.rejects(db.query(`select public.update_coach_account($1,'Fake',true)`,[id(2)]),{code:'42501'});
  await as(1);await db.query(`select public.update_coach_account($1,'Updated Coach',false)`,[id(3)]);
  await as(3);await assert.rejects(accept(1),{code:'42501'});assert.equal((await db.query(`select id from public.profiles where id='${id(3)}'`)).rows.length,0);
  await as(1);await db.query(`select public.update_coach_account($1,'Updated Coach',true)`,[id(3)]);await as(3);await accept(1);
  await as(1);await db.exec(`insert into public.user_roles values('${id(1)}','COACH')`);
  await assert.rejects(db.query(`select public.update_coach_account($1,'Admin',false)`,[id(1)]),{code:'23514'});
 });
 }finally{await db.close();}
});
