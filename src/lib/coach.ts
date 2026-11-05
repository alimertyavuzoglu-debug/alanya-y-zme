import {z} from 'zod';
import type {ClubData} from './club-client';
export const coachTables=['groups','group_terms','athletes','enrollments','coach_assignments','training_plans','schedule_rules','sessions','session_coaches','session_athletes','athlete_attendance'] as const;
export const attendanceBatchSchema=z.object({
 session_id:z.string().uuid(),
 entries:z.array(z.object({athlete_id:z.string().uuid(),status:z.enum(['PRESENT','ABSENT','EXCUSED']),note:z.string().max(500).nullable().optional()}).strict()).min(1).max(100),
}).strict().refine(v=>new Set(v.entries.map(x=>x.athlete_id.toLowerCase())).size===v.entries.length,'Aynı sporcu iki kez seçilemez.');
export function coachScope(source:ClubData,userId:string):ClubData{
 const assignments=(source.coach_assignments??[]).filter(a=>a.coach_id===userId);
 const links=(source.session_coaches??[]).filter(a=>a.coach_id===userId);
 const lessonIds=new Set(links.map(a=>a.session_id));
 const sessions=(source.sessions??[]).filter(s=>lessonIds.has(s.id));
 const terms=new Set([...assignments.map(a=>a.group_term_id),...sessions.map(s=>s.group_term_id)]);
 const periods=(source.group_terms??[]).filter(t=>terms.has(t.id));
 const groups=new Set(periods.map(t=>t.group_id));
 const roster=(source.session_athletes??[]).filter(a=>lessonIds.has(a.session_id));
 const enrollments=(source.enrollments??[]).filter(e=>terms.has(e.group_term_id));
 const athletes=new Set([...roster.map(a=>a.athlete_id),...enrollments.map(a=>a.athlete_id)]);
 return {...source,coach_assignments:assignments,session_coaches:links,sessions,group_terms:periods,groups:(source.groups??[]).filter(g=>groups.has(g.id)),session_athletes:roster,enrollments,athletes:(source.athletes??[]).filter(a=>athletes.has(a.id)),athlete_attendance:(source.athlete_attendance??[]).filter(a=>a.recorded_by===userId&&lessonIds.has(a.session_id)),training_plans:(source.training_plans??[]).filter(p=>p.group_term_id===null||terms.has(p.group_term_id)),schedule_rules:(source.schedule_rules??[]).filter(r=>terms.has(r.group_term_id))};
}
