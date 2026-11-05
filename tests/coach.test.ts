import {test} from 'node:test';import assert from 'node:assert/strict';
import {attendanceBatchSchema,coachScope,coachTables} from '../src/lib/coach';
const id='00000000-0000-4000-8000-000000000001';
test('coach batch validates identity, duplication, status and bounded size',()=>{
 const entry={athlete_id:id,status:'PRESENT'};
 assert.equal(attendanceBatchSchema.safeParse({session_id:id,entries:[entry]}).success,true);
 assert.equal(attendanceBatchSchema.safeParse({session_id:id,entries:[entry,entry]}).success,false);
 assert.equal(attendanceBatchSchema.safeParse({session_id:id,entries:[{...entry,status:'UNKNOWN'}]}).success,false);
 assert.equal(attendanceBatchSchema.safeParse({session_id:id,entries:[]}).success,false);
 assert.equal(attendanceBatchSchema.safeParse({session_id:id,entries:[{...entry,recorded_by:id}]}).success,false);
});
test('coach dashboard scopes mixed admin data to own assignments and records',()=>{
 const source=Object.fromEntries(coachTables.map(t=>[t,[]])) as Parameters<typeof coachScope>[0];
 Object.assign(source,{coach_assignments:[{coach_id:'me',group_term_id:'term1'},{coach_id:'peer',group_term_id:'term2'}],session_coaches:[{coach_id:'me',session_id:'s1'},{coach_id:'peer',session_id:'s2'}],sessions:[{id:'s1',group_term_id:'term1'},{id:'s2',group_term_id:'term2'}],group_terms:[{id:'term1',group_id:'g1'},{id:'term2',group_id:'g2'}],groups:[{id:'g1'},{id:'g2'}],enrollments:[{group_term_id:'term1',athlete_id:'a1'},{group_term_id:'term2',athlete_id:'a2'}],athletes:[{id:'a1'},{id:'a2'}],athlete_attendance:[{session_id:'s1',recorded_by:'me'},{session_id:'s1',recorded_by:'peer'}]});
 const result=coachScope(source,'me');assert.deepEqual(result.sessions.map(s=>s.id),['s1']);assert.deepEqual(result.athletes.map(a=>a.id),['a1']);assert.equal(result.athlete_attendance.length,1);assert.equal(result.groups.length,1);
});
