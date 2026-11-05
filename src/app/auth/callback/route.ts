import { NextResponse } from 'next/server';
import { configurationPresent, supabase } from '@/lib/supabase';
import { expectedOrigin } from '@/lib/origin';
import { invitationReturnPath } from '@/lib/invitations';
import { failure } from '@/lib/http';
import { invitationHeaders } from '@/lib/invitation-server';
export async function GET(request: Request) {
 const origin=expectedOrigin(request);if(!origin)return failure('İstek kaynağı doğrulanamadı.',403);
 const url=new URL(request.url);const path=invitationReturnPath(url.searchParams.get('next'));const code=url.searchParams.get('code');
 if(code&&configurationPresent()){
  const client=await supabase();const {error}=await client.auth.exchangeCodeForSession(code);
  if(!error)return NextResponse.redirect(new URL(path,origin),{status:303,headers:invitationHeaders});
 }
 const destination=new URL(path,origin);destination.searchParams.set('auth_error','1');
 return NextResponse.redirect(destination,{status:303,headers:invitationHeaders});
}
