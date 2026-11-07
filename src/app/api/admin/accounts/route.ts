import {NextResponse} from 'next/server';
import {z} from 'zod';
import {roleSession} from '@/lib/role-session';
import {failure,mutationGuard,readBody} from '@/lib/http';
import {invitationFailure,invitationHeaders} from '@/lib/invitation-server';
import {accountUpdateSchema,accountRemovalSchema} from '@/lib/accounts';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const auth=await roleSession('ADMIN');if(auth.response)return auth.response;
 const page=z.coerce.number().int().min(0).max(10000).safeParse(new URL(request.url).searchParams.get('page')??0);if(!page.success)return failure('Geçersiz sayfa.',400);
 const {data,error}=await auth.client.rpc('list_club_accounts',{page_offset:page.data*50});
 if(error)return invitationFailure(error);
 return NextResponse.json({data},{headers:invitationHeaders});
}
export async function PATCH(request:Request){
 const guard=mutationGuard(request);if(guard)return guard;
 const auth=await roleSession('ADMIN');if(auth.response)return auth.response;
 let body:unknown;try{body=await readBody(request);}catch{return failure('Geçersiz istek.',400);}
 const parsed=accountUpdateSchema.safeParse(body);if(!parsed.success)return failure('Ad, hesap durumu ve en az bir yetki seçin.',422);
 const {error}=await auth.client.rpc('update_club_account',{target_user:parsed.data.id,new_name:parsed.data.display_name,requested_roles:parsed.data.roles,active:parsed.data.is_active});
 if(error)return invitationFailure(error);
 return NextResponse.json({ok:true},{headers:invitationHeaders});
}
export async function DELETE(request:Request){
 const guard=mutationGuard(request);if(guard)return guard;
 const auth=await roleSession('ADMIN');if(auth.response)return auth.response;
 let body:unknown;try{body=await readBody(request);}catch{return failure('Geçersiz istek.',400);}
 const parsed=accountRemovalSchema.safeParse(body);if(!parsed.success)return failure('Kaldırılacak hesabı seçin.',422);
 const {error}=await auth.client.rpc('remove_club_account',{target_user:parsed.data.id});
 if(error)return invitationFailure(error);
 return NextResponse.json({ok:true},{headers:invitationHeaders});
}
