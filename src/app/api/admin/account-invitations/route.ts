import {NextResponse} from 'next/server';
import {randomBytes} from 'node:crypto';
import {z} from 'zod';
import {roleSession} from '@/lib/role-session';
import {failure,mutationGuard,readBody} from '@/lib/http';
import {expectedOrigin} from '@/lib/origin';
import {accountInvitationSchema} from '@/lib/accounts';
import {invitationFailure,invitationHeaders,tokenHash} from '@/lib/invitation-server';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const auth=await roleSession('ADMIN');if(auth.response)return auth.response;
 const page=z.coerce.number().int().min(0).max(10000).safeParse(new URL(request.url).searchParams.get('page')??0);if(!page.success)return failure('Geçersiz sayfa.',400);
 const {data,error}=await auth.client.from('coach_invitations').select('id,email,display_name,invite_role,status,created_at,expires_at,accepted_by').order('created_at',{ascending:false}).order('id').range(page.data*50,page.data*50+49);
 if(error)return invitationFailure(error);
 return NextResponse.json({data},{headers:invitationHeaders});
}
export async function POST(request:Request){
 const guard=mutationGuard(request);if(guard)return guard;
 const auth=await roleSession('ADMIN');if(auth.response)return auth.response;
 let body:unknown;try{body=await readBody(request);}catch{return failure('Geçersiz istek.',400);}
 const parsed=accountInvitationSchema.safeParse(body);if(!parsed.success)return failure('Ad, e-posta ve davet yetkisini kontrol edin.',422);
 const token=randomBytes(32).toString('hex');
 const {data,error}=await auth.client.rpc('create_account_invitation',{invite_email:parsed.data.email,invite_name:parsed.data.display_name,invite_hash:tokenHash(token),requested_role:parsed.data.role});
 if(error)return invitationFailure(error);
 return NextResponse.json({id:data,url:`${expectedOrigin(request)}/invite/${token}`},{status:201,headers:invitationHeaders});
}
export async function DELETE(request:Request){
 const guard=mutationGuard(request);if(guard)return guard;
 const auth=await roleSession('ADMIN');if(auth.response)return auth.response;
 let body:unknown;try{body=await readBody(request);}catch{return failure('Geçersiz istek.',400);}
 const parsed=z.object({id:z.string().uuid()}).strict().safeParse(body);if(!parsed.success)return failure('Davet seçin.',422);
 const {error}=await auth.client.rpc('revoke_coach_invitation',{invitation_id:parsed.data.id});
 if(error)return invitationFailure(error);
 return NextResponse.json({ok:true},{headers:invitationHeaders});
}
