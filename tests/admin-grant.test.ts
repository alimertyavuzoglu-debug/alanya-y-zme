import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const id=(n:number)=>`30000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
test('manual administrator grant is exact-email, verified, atomic and idempotent',async t=>{
 const db=new PGlite();try{
 await db.exec(`create role anon nologin;create role authenticated nologin;
 create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
 create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,update,delete on storage.objects to authenticated;`);
 for(const file of (await readdir(new URL('../supabase/migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
 const sql=await readFile(new URL('../supabase/operations/grant-denizaslanlari-admin.sql',import.meta.url),'utf8');
 const preview=await readFile(new URL('../supabase/operations/preview-denizaslanlari-admin.sql',import.meta.url),'utf8');
 const grant=async()=>{try{await db.exec(sql);}catch(e){await db.exec('rollback');throw e;}};
 await db.exec(`insert into auth.users values('${id(1)}','existing@example.com',now(),'{}');insert into public.profiles(id,display_name) values('${id(1)}','Original administrator');insert into public.user_roles values('${id(1)}','ADMIN');`);
 await t.test('missing account makes no profile or role and preview is empty',async()=>{
  await assert.rejects(grant,/Tek hesap bulunmali/);const r=await db.query<{n:number}>('select count(*)::int n from public.user_roles');assert.equal(r.rows[0].n,1);assert.equal((await db.exec(preview))[0].rows.length,0);
 });
 await db.exec(`insert into auth.users values('${id(2)}','DenizAslanlari@Gmail.com',null,'{}');`);
 await t.test('unverified email and ambiguous matches fail before writes',async()=>{
  await assert.rejects(grant,/dogrulanmamis/);assert.equal((await db.query('select * from public.profiles where id=$1',[id(2)])).rows.length,0);
  await db.exec(`insert into auth.users values('${id(3)}','denizaslanlari@gmail.com',now(),'{}');`);await assert.rejects(grant,/Tek hesap bulunmali/);await db.exec(`delete from auth.users where id='${id(3)}'`);
 });
 await db.exec(`update auth.users set email_confirmed_at=now() where id='${id(2)}';`);
 await t.test('verified target receives an active profile and exactly one ADMIN role; retry is harmless',async()=>{
  await grant();await grant();const roles=(await db.query<{user_id:string;role:string}>('select * from public.user_roles order by user_id')).rows;assert.deepEqual(roles,[{user_id:id(1),role:'ADMIN'},{user_id:id(2),role:'ADMIN'}]);const p=(await db.query<{is_active:boolean}>('select is_active from public.profiles where id=$1',[id(2)])).rows[0];assert.equal(p.is_active,true);
 });
 await t.test('existing profile name and COACH role are preserved',async()=>{
  await db.exec(`update public.profiles set display_name='Keep this name' where id='${id(2)}';insert into public.user_roles values('${id(2)}','COACH');`);await grant();assert.equal((await db.query<{display_name:string}>('select display_name from public.profiles where id=$1',[id(2)])).rows[0].display_name,'Keep this name');assert.equal((await db.query('select * from public.user_roles where user_id=$1',[id(2)])).rows.length,2);
 });
 await t.test('disabled target is not silently reactivated',async()=>{
  await db.exec(`update public.profiles set is_active=false where id='${id(2)}'`);await assert.rejects(grant,/Hedef hesap pasif/);assert.equal((await db.query<{is_active:boolean}>('select is_active from public.profiles where id=$1',[id(2)])).rows[0].is_active,false);
 });
 await t.test('ordinary authenticated users cannot execute the privileged SQL operation',async()=>{
  await db.exec('set role authenticated');await assert.rejects(grant,{code:'42501'});await db.exec('reset role');
 });
 }finally{await db.close();}
});
