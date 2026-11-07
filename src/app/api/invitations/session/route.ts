import { NextResponse } from 'next/server';
import { configurationPresent, supabase } from '@/lib/supabase';
import { failure, mutationGuard, readBody } from '@/lib/http';
import { expectedOrigin } from '@/lib/origin';
import { invitationSessionSchema } from '@/lib/invitations';
import { invitationFailure, invitationHeaders, invitationDestination, lookupInvitation, tokenHash } from '@/lib/invitation-server';
export async function POST(request: Request) {
 const guard=mutationGuard(request);if(guard)return guard;
 if(!configurationPresent())return failure('Hesap sistemi yapılandırılmadı.',503);
 let body: unknown;try{body=await readBody(request);}catch{return failure('Geçersiz istek.',400);}
 const parsed=invitationSessionSchema.safeParse(body);if(!parsed.success)return failure('Bilgileri kontrol edin. Yeni parola en az 12 karakter olmalı.',422);
 const client=await supabase();const result=await lookupInvitation(client,parsed.data.token);if(result.response)return result.response;
 const email=result.invitation.email;
 const credentials={email,password:parsed.data.password};
 if(parsed.data.action==='signup'){
  const {data,error}=await client.auth.signUp({...credentials,options:{emailRedirectTo:`${expectedOrigin(request)}/auth/callback?next=/invite/${parsed.data.token}`}});
  if(error)return failure(error.status===429?'Çok fazla deneme yapıldı. E-posta gönderim sınırı nedeniyle daha sonra tekrar deneyin.':'Hesap oluşturulamadı. Hesabınız varsa mevcut parolanızla giriş yapın; aksi halde yöneticinizle görüşün.',error.status===429?429:422);
  if(!data.session)return NextResponse.json({needs_confirmation:true},{headers:invitationHeaders});
 }else{
  const {error}=await client.auth.signInWithPassword(credentials);
  if(error)return failure(error.status===429?'Çok fazla giriş denemesi yapıldı. Daha sonra tekrar deneyin.':'Giriş yapılamadı. Parolanızı ve e-posta doğrulamanızı kontrol edin.',error.status===429?429:401);
 }
 const {error}=await client.rpc('accept_coach_invitation',{invite_hash:tokenHash(parsed.data.token)});
 if(error)return invitationFailure(error);
 const destination=await invitationDestination(client);if(destination.response)return destination.response;
 return NextResponse.json({ok:true,destination:destination.destination},{headers:invitationHeaders});
}
