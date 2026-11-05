import { NextResponse } from 'next/server';
import { configurationPresent, supabase } from '@/lib/supabase';
import { failure } from '@/lib/http';
import { inviteTokenSchema } from '@/lib/invitations';
import { invitationHeaders, lookupInvitation } from '@/lib/invitation-server';
export const dynamic='force-dynamic';
export async function GET(request: Request) {
 const token=inviteTokenSchema.safeParse(new URL(request.url).searchParams.get('token'));
 if(!token.success)return failure('Geçersiz davet bağlantısı.',404);
 if(!configurationPresent())return failure('Hesap sistemi yapılandırılmadı.',503);
 const client=await supabase();const result=await lookupInvitation(client,token.data);if(result.response)return result.response;
 const {data}=await client.auth.getUser();
 return NextResponse.json({invitation:result.invitation,user:data.user?{email:data.user.email,confirmed:Boolean(data.user.email_confirmed_at)}:null},{headers:invitationHeaders});
}
