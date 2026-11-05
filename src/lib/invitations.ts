import { z } from 'zod';
export const inviteTokenSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const invitationSchema = z.object({
 email: z.string().trim().email().max(254).transform(s => s.toLowerCase()),
 display_name: z.string().trim().min(1).max(150),
}).strict();
export const coachAccountSchema = z.object({
 id: z.string().uuid(), display_name: z.string().trim().min(1).max(150), is_active: z.boolean(),
}).strict();
export const invitationSessionSchema = z.object({
 token: inviteTokenSchema, action: z.enum(['signup', 'signin']), password: z.string().min(1).max(256),
}).strict().refine(v => v.action !== 'signup' || v.password.length >= 12, 'Parola en az 12 karakter olmalı.');
export type CoachInvitation = {
 id: string; email: string; display_name: string; status: 'PENDING'|'ACCEPTED'|'REVOKED';
 created_at: string; expires_at: string; accepted_by: string|null;
};
export type InvitationInfo = Pick<CoachInvitation,'email'|'display_name'|'expires_at'|'status'>;
// Only our own invitation route may follow the PKCE exchange. Never accept a URL or arbitrary path.
export function invitationReturnPath(next: string|null) {
 return next && /^\/invite\/[a-f0-9]{64}$/.test(next) ? next : '/login';
}
