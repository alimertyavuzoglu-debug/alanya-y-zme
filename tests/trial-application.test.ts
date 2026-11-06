import {test} from 'node:test';
import assert from 'node:assert/strict';
import {trialApplicationSchema,trialEmailFields} from '../src/lib/trial-application';
const valid={name:'Veli Örnek',phone:'0555 123 45 67',register_for:'SELF',child_age:null,lesson_type:'SWIMMING',message:'Akşam saatleri',consent:true};
test('trial application requires usable contact, a supported lesson and explicit consent',()=>{
 assert.equal(trialApplicationSchema.safeParse(valid).success,true);
 for(const body of [{...valid,name:' '},{...valid,phone:'123'},{...valid,phone:'0555<script>'},{...valid,lesson_type:'OTHER'},{...valid,consent:false},{...valid,message:'a'.repeat(1001)},{...valid,role:'ADMIN'}])assert.equal(trialApplicationSchema.safeParse(body).success,false);
});
test('child application requires age and formats only the requested contact fields',()=>{
 assert.equal(trialApplicationSchema.safeParse({...valid,register_for:'CHILD'}).success,false);
 const child=trialApplicationSchema.parse({...valid,register_for:'CHILD',child_age:8});
 const payload=trialEmailFields(child);assert.equal(payload.child_age,'8');assert.equal(payload.lesson_type,'Yüzme');assert.equal(payload.register_for,'Çocuğum için');assert.equal('health_info' in payload,false);
 const self=trialEmailFields(trialApplicationSchema.parse({...valid,child_age:8}));assert.equal('child_age' in self,false);
});
