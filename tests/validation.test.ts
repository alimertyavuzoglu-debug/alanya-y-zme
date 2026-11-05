import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resourceDefinition } from '../src/lib/resources';
import { mutationGuard, readBody } from '../src/lib/http';

test('resource whitelist rejects prototype and arbitrary table access',()=>{
 for(const key of ['__proto__','constructor','user_roles','profiles','audit_logs','auth.users']) assert.equal(resourceDefinition(key),null);
});
test('attendance accepts only supported statuses and rejects author spoofing',()=>{
 const schema=resourceDefinition('athlete_attendance')!.schema;
 const body={session_id:'00000000-0000-4000-8000-000000000001',athlete_id:'00000000-0000-4000-8000-000000000002',status:'PRESENT'};
 assert.equal(schema.safeParse(body).success,true);
 assert.equal(schema.safeParse({...body,status:'UNKNOWN'}).success,false);
 assert.equal(schema.safeParse({...body,recorded_by:body.athlete_id}).success,false);
});
test('writes require same-origin JSON requests',()=>{
 const request=(origin?:string,type='application/json')=>new Request('https://club.example/api/club/athletes',{method:'POST',headers:{...(origin?{origin}:{}),'content-type':type},body:'{}'});
 assert.equal(mutationGuard(request('https://club.example')),null);
 const loopback = new Request('http://localhost:3000/api/auth/login',{method:'POST',headers:{host:'127.0.0.1:3000',origin:'http://127.0.0.1:3000','content-type':'application/json'},body:'{}'});
 assert.equal(mutationGuard(loopback),null);
 assert.equal(mutationGuard(request('https://attacker.example'))?.status,403);
 assert.equal(mutationGuard(request())?.status,403);
 assert.equal(mutationGuard(request('https://club.example','text/plain'))?.status,415);
});
test('streamed request size limit cannot be bypassed without content-length',async()=>{
 await assert.rejects(readBody(new Request('https://club.example',{method:'POST',body:JSON.stringify({note:'a'.repeat(40000)})})),/BODY_TOO_LARGE/);
});


test('configuration rejects keys in URL and privileged credentials',async()=>{
 const { validConfiguration } = await import('../src/lib/supabase');
 assert.equal(validConfiguration('sb_publishable_example','sb_secret_example'),false);
 assert.equal(validConfiguration('https://example.supabase.co','sb_secret_example'),false);
 assert.equal(validConfiguration('https://example.supabase.co','sb_publishable_example_public_key'),true);
 const privileged='header.'+Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')+'.signature';
 assert.equal(validConfiguration('https://example.supabase.co',privileged),false);
});
