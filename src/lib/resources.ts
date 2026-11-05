import { z } from 'zod';
const id = z.string().uuid();
const text = z.string().trim().min(1).max(150);
const date = z.string().date();
const instant = z.string().datetime({ offset: true });
const object = <T extends z.ZodRawShape>(shape: T) => z.object(shape).strict();

export const resources = {
  groups: { keys: ['id'], schema: object({ name: text, sport: text.optional(), level: text.nullable().optional(), is_active: z.boolean().optional() }) },
  group_terms: { keys: ['id'], schema: object({ group_id: id, name: text, start_date: date, end_date: date, status: z.enum(['DRAFT','ACTIVE','CLOSED']).optional() }) },
  athletes: { keys: ['id'], schema: object({ first_name: text.max(100), last_name: text.max(100), birth_date: date.nullable().optional(), is_active: z.boolean().optional() }) },
  guardians: { keys: ['id'], schema: object({ name: text, phone: text.nullable().optional(), email: z.string().email().nullable().optional() }) },
  athlete_guardians: { keys: ['athlete_id','guardian_id'], schema: object({ athlete_id: id, guardian_id: id, relationship: text, is_primary: z.boolean().optional() }) },
  enrollments: { keys: ['id'], schema: object({ group_term_id: id, athlete_id: id, joined_on: date, left_on: date.nullable().optional() }) },
  coach_assignments: { keys: ['id'], schema: object({ group_term_id: id, coach_id: id, starts_on: date, ends_on: date }) },
  training_plans: { keys: ['id'], schema: object({ group_term_id: id.nullable().optional(), title: text.max(200), content: z.string().trim().min(1).max(20000) }) },
  schedule_rules: { keys: ['id'], schema: object({ group_term_id: id, weekday: z.number().int().min(1).max(7), local_start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/), duration_minutes: z.number().int().min(1).max(720), valid_from: date, valid_until: date }) },
  sessions: { keys: ['id'], schema: object({ group_term_id: id, schedule_rule_id: id.nullable().optional(), training_plan_id: id.nullable().optional(), starts_at: instant, ends_at: instant, status: z.enum(['SCHEDULED','COMPLETED','CANCELLED']).optional() }) },
  session_coaches: { keys: ['session_id','coach_id'], schema: object({ session_id: id, coach_id: id, participation_status: z.enum(['UNCONFIRMED','ATTENDED','ABSENT','EXCUSED']).optional() }) },
  session_athletes: { keys: ['session_id','athlete_id'], schema: object({ session_id: id, athlete_id: id, enrollment_id: id }) },
  athlete_attendance: { keys: ['session_id','athlete_id'], schema: object({ session_id: id, athlete_id: id, status: z.enum(['PRESENT','ABSENT','EXCUSED']), note: z.string().max(500).nullable().optional() }) },
} as const;
export type Resource = keyof typeof resources;
export function resourceDefinition(name: string) { return Object.hasOwn(resources, name) ? resources[name as Resource] : null; }
