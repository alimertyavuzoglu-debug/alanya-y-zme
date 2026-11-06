import {test} from 'node:test';
import assert from 'node:assert/strict';
import {expectedOrigin} from '../src/lib/origin';
import {mutationGuard} from '../src/lib/http';
const names=['APP_ORIGIN','NETLIFY','CONTEXT','URL','DEPLOY_PRIME_URL'] as const;
function withEnv(values:Record<string,string>,run:()=>void){
 const prior=Object.fromEntries(names.map(n=>[n,process.env[n]]));
 try{for(const n of names)delete process.env[n];Object.assign(process.env,values);run();}
 finally{for(const n of names){const value=prior[n];if(value===undefined)delete process.env[n];else process.env[n]=value;}}
}
const req=(origin='https://club.netlify.app')=>new Request('http://internal:3000/api/auth/login',{method:'POST',headers:{origin,'content-type':'application/json'},body:'{}'});
test('Netlify production uses canonical URL behind proxy',()=>withEnv({NETLIFY:'true',CONTEXT:'production',URL:'https://club.netlify.app'},()=>{
 assert.equal(expectedOrigin(req()),'https://club.netlify.app');assert.equal(mutationGuard(req()),null);assert.equal(mutationGuard(req('https://attacker.example'))?.status,403);
}));
test('deploy preview uses its own origin; explicit origin overrides it',()=>withEnv({NETLIFY:'true',CONTEXT:'deploy-preview',URL:'https://club.netlify.app',DEPLOY_PRIME_URL:'https://deploy-preview-3--club.netlify.app'},()=>{
 assert.equal(expectedOrigin(req()),'https://deploy-preview-3--club.netlify.app');
 process.env.APP_ORIGIN='https://custom.example/';assert.equal(expectedOrigin(req()),'https://custom.example');
}));
test('invalid explicit origin fails closed and unrelated URL env is ignored',()=>withEnv({APP_ORIGIN:'javascript:alert(1)'},()=>{
 assert.equal(expectedOrigin(req()),null);assert.equal(mutationGuard(req())?.status,403);
 delete process.env.APP_ORIGIN;process.env.URL='https://unrelated.example';assert.equal(expectedOrigin(req()),'http://internal:3000');
}));
test('public primary domain keeps authenticated writes on the portal origin',()=>withEnv({NETLIFY:'true',CONTEXT:'production',URL:'https://alanyadenizaslanlarisk.com',APP_ORIGIN:'https://panel.alanyadenizaslanlarisk.com'},()=>{
 assert.equal(mutationGuard(req('https://panel.alanyadenizaslanlarisk.com')),null);
 assert.equal(mutationGuard(req('https://alanyadenizaslanlarisk.com'))?.status,403);
 assert.equal(mutationGuard(req('https://panel.alanyadenizaslanlarisk.com.attacker.example'))?.status,403);
}));
