import {NextResponse} from 'next/server';
import {z} from 'zod';
import {authenticated,databaseFailure,failure,mutationGuard,readBody} from '@/lib/http';
import {contentSchema,resolveContent} from '@/lib/site-content';
export const dynamic='force-dynamic';
async function admin(){
 const auth=await authenticated();if(auth.response)return auth;
 const {data,error}=await auth.client.from('user_roles').select('role').eq('user_id',auth.user.id);
 if(error)return {response:databaseFailure(error)};
 if(!data.some(r=>r.role==='ADMIN'))return {response:failure('Yönetici yetkisi gerekli.',403)};
 return auth;
}
export async function GET(){
 const auth=await admin();if(auth.response)return auth.response;
 const {data,error}=await auth.client.from('site_content').select('content,revision').eq('key','homepage').single();
 if(error)return error.code==='PGRST205'||error.code==='PGRST116'?failure('Site içeriği kurulumu gerekli. 003 migration dosyasını uygulayın.',503):databaseFailure(error);
 const parsed=resolveContent(data.content);
 if(!parsed.success)return failure('Kayıtlı site içeriği geçersiz; veritabanı kaydını kontrol edin.',422);
 return NextResponse.json({content:parsed.data,revision:data.revision},{headers:{'Cache-Control':'no-store'}});
}
export async function PUT(request:Request){
 const guard=mutationGuard(request);if(guard)return guard;
 const auth=await admin();if(auth.response)return auth.response;
 let raw:unknown;try{raw=await readBody(request);}catch{return failure('Geçersiz veya fazla büyük JSON.',400);}
 const parsed=z.object({content:contentSchema,revision:z.number().int().min(0)}).strict().safeParse(raw);
 if(!parsed.success)return failure('Alanları ve görsel adreslerini kontrol edin.',422);
 const {data,error}=await auth.client.from('site_content').update({content:parsed.data.content}).eq('key','homepage').eq('revision',parsed.data.revision).select('revision').maybeSingle();
 if(error)return databaseFailure(error);
 if(!data)return failure('İçerik başka bir oturumda değişti. Değişikliklerinizi kopyalayıp sayfayı yenileyin.',409);
 return NextResponse.json({revision:data.revision},{headers:{'Cache-Control':'no-store'}});
}
