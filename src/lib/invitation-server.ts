import 'server-only';
import { createHash } from 'node:crypto';
import { supabase } from './supabase';
import { databaseFailure, failure } from './http';
import type { InvitationInfo } from './invitations';
export const invitationHeaders = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' };
export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
export function invitationFailure(error: {code?: string; message?: string}) {
 if (['PGRST202','PGRST205','PGRST204','42703'].includes(error.code??'')) return failure('Hesap yönetimi kurulumu gerekli. Yönetici bir defalık kurulumu tamamlamalı.',503);
 const messages: Record<string,string> = {
  'Club account already exists':'Bu e-posta için kulüp hesabı zaten var. Hesaplar ve yetkiler bölümünden düzenleyin.',
  'Cannot remove own administrator access':'Kendi yönetici erişiminizi kaldıramaz veya hesabınızı pasifleştiremezsiniz.',
  'Last active administrator':'Son aktif yöneticinin erişimi kaldırılamaz. Önce başka bir yönetici yetkilendirin.',
  'Invalid account roles':'En az bir geçerli yetki seçin. Aynı yetkiyi birden fazla seçmeyin.',
  'Account not found':'Hesap bulunamadı. Listeyi yenileyin.',
  'Invitation issuer no longer authorized':'Bu daveti oluşturan yöneticinin yetkisi kaldırılmış. Güncel yöneticiden yeni davet isteyin.',
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
 let {data,error}=await client.rpc('lookup_account_invitation',{invite_hash:tokenHash(token)});
 // Old coach links continue to work while the one-time account migration is pending.
 if(error?.code==='PGRST202')({data,error}=await client.rpc('lookup_coach_invitation',{invite_hash:tokenHash(token)}));
 if(error)return {response:invitationFailure(error)};
 if(!data?.length)return {response:failure('Davet geçersiz, süresi dolmuş veya iptal edilmiş. Yöneticiden yeni bağlantı isteyin.',404)};
 return {invitation:data[0] as InvitationInfo};
}

export async function invitationDestination(client:Awaited<ReturnType<typeof supabase>>){
 const {data:{user}}=await client.auth.getUser();if(!user)return {response:failure('Oturum açmanız gerekiyor.',401)};
 const {data,error}=await client.from('user_roles').select('role').eq('user_id',user.id);
 if(error)return {response:databaseFailure(error)};
 if(data.some(r=>r.role==='ADMIN'))return {destination:'/admin' as const};
 if(data.some(r=>r.role==='COACH'))return {destination:'/coach' as const};
 return {response:failure('Bu hesap için kulüp yetkisi bulunamadı. Yöneticinizle görüşün.',403)};
}
