import { NextResponse } from 'next/server';
import { authenticated, databaseFailure, failure, mutationGuard, readBody } from '@/lib/http';
import { roleSession } from '@/lib/role-session';
import { coachAccountSchema } from '@/lib/invitations';
import { invitationFailure, invitationHeaders } from '@/lib/invitation-server';
export const dynamic='force-dynamic';
export async function GET() {
 const auth=await authenticated(); if(auth.response)return auth.response;
 const roles: {user_id:string;role:string}[]=[];
 for(let page=0;page<=10000;page++){
  const {data,error}=await auth.client.from('user_roles').select('user_id,role').order('user_id').order('role').range(page*100,page*100+99);
  if(error)return databaseFailure(error);
  roles.push(...data);if(data.length<100)break;
 }
 if(!roles.some(r=>r.user_id===auth.user.id&&r.role==='ADMIN'))return failure('Yönetici yetkisi gerekli.',403);
 const ids=roles.filter(r=>r.role==='COACH').map(r=>r.user_id);
 // Paginate profiles rather than relying on Supabase's default row limit.
 const result: {id:string;display_name:string;is_active:boolean}[]=[];
 for(let offset=0;offset<ids.length;offset+=100) {
  const {data,error}=await auth.client.from('profiles').select('id,display_name,is_active').in('id',ids.slice(offset,offset+100)).order('display_name');
  if(error)return databaseFailure(error); result.push(...data);
 }
 return NextResponse.json({data:result},{headers:{'Cache-Control':'no-store'}});
}

export async function PATCH(request: Request) {
 const guard=mutationGuard(request);if(guard)return guard;
 const auth=await roleSession('ADMIN');if(auth.response)return auth.response;
 let body: unknown;try{body=await readBody(request);}catch{return failure('Geçersiz istek.',400);}
 const parsed=coachAccountSchema.safeParse(body);if(!parsed.success)return failure('Antrenör bilgilerini kontrol edin.',422);
 const {error}=await auth.client.rpc('update_coach_account',{
  coach_user:parsed.data.id,new_name:parsed.data.display_name,active:parsed.data.is_active,
 });
 if(error)return invitationFailure(error);
 return NextResponse.json({ok:true},{headers:invitationHeaders});
}
