import { NextResponse } from 'next/server';
import { z } from 'zod';
import { configurationPresent, supabase } from '@/lib/supabase';
import { failure, mutationGuard, readBody } from '@/lib/http';
import { inviteTokenSchema } from '@/lib/invitations';
import { invitationFailure, invitationHeaders, invitationDestination, tokenHash } from '@/lib/invitation-server';
export async function POST(request: Request) {
 const guard=mutationGuard(request);if(guard)return guard;
 if(!configurationPresent())return failure('Hesap sistemi yapılandırılmadı.',503);
 let body: unknown;try{body=await readBody(request);}catch{return failure('Geçersiz istek.',400);}
 const parsed=z.object({token:inviteTokenSchema}).strict().safeParse(body);if(!parsed.success)return failure('Geçersiz davet bağlantısı.',404);
 const client=await supabase();const {data}=await client.auth.getUser();if(!data.user)return failure('Önce davet hesabınıza giriş yapın.',401);
 const {error}=await client.rpc('accept_coach_invitation',{invite_hash:tokenHash(parsed.data.token)});
 if(error)return invitationFailure(error);
 const destination=await invitationDestination(client);if(destination.response)return destination.response;
 return NextResponse.json({ok:true,destination:destination.destination},{headers:invitationHeaders});
}
