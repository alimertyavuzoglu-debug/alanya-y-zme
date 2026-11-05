import {NextResponse} from 'next/server';
import {authenticated,databaseFailure,failure,mutationGuard,readBody} from '@/lib/http';
import {attendanceBatchSchema} from '@/lib/coach';
export async function POST(request:Request){
 const guard=mutationGuard(request);if(guard)return guard;
 const auth=await authenticated();if(auth.response)return auth.response;
 const {data:roles,error:roleError}=await auth.client.from('user_roles').select('role').eq('user_id',auth.user.id);
 if(roleError)return databaseFailure(roleError);
 if(!roles.some(r=>r.role==='COACH'))return failure('Antrenör yetkisi gerekli.',403);
 let raw:unknown;try{raw=await readBody(request,262144);}catch{return failure('Geçersiz veya fazla büyük yoklama isteği.',400);}
 const parsed=attendanceBatchSchema.safeParse(raw);
 if(!parsed.success)return failure('1–100 farklı sporcu seçin; durumları ve notları kontrol edin.',422);
 const {data,error}=await auth.client.rpc('record_my_attendance',{lesson:parsed.data.session_id,entries:parsed.data.entries});
 if(error){
  if(error.code==='PGRST202')return failure('Antrenör yoklama kurulumu gerekli. 004 migration uygulanmalı.',503);
  if(error.code==='42501')return failure('Bu ders veya seçilen kayıtlar için düzenleme yetkiniz yok. Yöneticiyle görüşün; seçimleriniz kaydedilmedi.',403);
  return databaseFailure(error);
 }
 return NextResponse.json({data},{headers:{'Cache-Control':'no-store'}});
}
