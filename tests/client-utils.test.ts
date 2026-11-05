import {test} from 'node:test';
import assert from 'node:assert/strict';
import {csvCell,istanbulDate,toInstant,toLocalInput} from '../src/lib/club-client';
import {formPayload} from '../src/components/admin/record-form';
test('lesson inputs use Istanbul regardless of browser timezone and roundtrip',()=>{
 assert.equal(toInstant('2026-11-05T00:30'),'2026-11-04T21:30:00.000Z');
 assert.equal(toLocalInput('2026-11-04T21:30:00.000Z'),'2026-11-05T00:30');
 assert.equal(istanbulDate('2026-11-04T21:30:00.000Z'),'2026-11-05');
});
test('CSV neutralizes spreadsheet formulas and escapes quotes',()=>{
 assert.equal(csvCell('=1+1'),'"\'=1+1"');
 assert.equal(csvCell('  @SUM(A1)'),'"\'  @SUM(A1)"');
 assert.equal(csvCell('a,"b"'),'"a,""b"""');
});
test('record form preserves explicit null, numbers and unchecked active flag',()=>{
 const form=new FormData();form.set('name','  Sporcu  ');form.set('duration','45');form.set('left_on','');form.set('starts_at','2026-11-05T12:30');
 assert.deepEqual(formPayload([{key:'name',label:'Ad'},{key:'duration',label:'Süre',type:'number'},{key:'left_on',label:'Ayrılış',type:'date',optional:true,nullable:true},{key:'is_active',label:'Aktif',type:'checkbox'},{key:'starts_at',label:'Başlangıç',type:'datetime-local'}],form),{name:'Sporcu',duration:45,left_on:null,is_active:false,starts_at:'2026-11-05T09:30:00.000Z'});
});
