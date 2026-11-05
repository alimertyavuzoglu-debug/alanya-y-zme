import 'server-only';
import { createHash } from 'node:crypto';
import { supabase } from './supabase';
import { databaseFailure, failure } from './http';
import type { InvitationInfo } from './invitations';
export const invitationHeaders = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' };
export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
export function invitationFailure(error: {code?: string; message?: string}) {
 if (error.code === 'PGRST202' || error.code === 'PGRST205') return failure('Antrenör davet sistemi henüz etkinleştirilmemiş. Yönetici kurulumu tamamlamalı.',503);
 const messages: Record<string,string> = {
  'Coach account already exists':'Bu e-posta için antrenör hesabı zaten var. Mevcut hesabı listeden yönetin.',
  'Inactive account must be managed by admin':'Bu hesap pasif. Mevcut hesabı listeden aktifleştirin.',
  'Verified email required':'Önce e-posta adresinizi doğrulayın.',
  'Invitation does not match account':'Bu davet oturum açtığınız e-posta adresine ait değil.',
  'Invitation unavailable':'Davetin süresi dolmuş veya iptal edilmiş. Yöneticiden yeni bağlantı isteyin.',
  'Inactive account':'Hesabınız pasif. Yöneticinizle görüşün.',
  'Admin account cannot be disabled here':'Yönetici yetkisi de olan hesap bu ekrandan pasifleştirilemez.',
  'Invitation already handled':'Bu davet artık beklemiyor. Listeyi yenileyin.',
 };
 if (error.message && messages[error.message]) return failure(messages[error.message],error.code==='42501'?403:error.code==='23505'||error.code==='40001'?409:422);
 return databaseFailure(error);
}
export async function lookupInvitation(client: Awaited<ReturnType<typeof supabase>>, token: string) {
 const {data,error}=await client.rpc('lookup_coach_invitation',{invite_hash:tokenHash(token)});
 if(error)return {response:invitationFailure(error)};
 if(!data?.length)return {response:failure('Davet geçersiz, süresi dolmuş veya iptal edilmiş. Yöneticiden yeni bağlantı isteyin.',404)};
 return {invitation:data[0] as InvitationInfo};
}
