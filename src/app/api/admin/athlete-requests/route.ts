import {NextResponse} from 'next/server';import {z} from 'zod';
import {roleSession,setupFailure} from '@/lib/role-session';
import {databaseFailure,failure,mutationGuard,readBody} from '@/lib/http';
import {reviewRequestSchema} from '@/lib/coach-workflow';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const auth=await roleSession('ADMIN');if(auth.response)return auth.response;
 const page=z.coerce.number().int().min(0).max(10000).safeParse(new URL(request.url).searchParams.get('page')??0);if(!page.success)return failure('Geçersiz sayfa.',400);
 const {data,error}=await auth.client.from('athlete_requests').select('*').order('created_at',{ascending:false}).order('id').range(page.data*50,page.data*50+49);
 if(error)return error.code==='PGRST205'?setupFailure():databaseFailure(error);
 return NextResponse.json({data},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(request:Request){
 const guard=mutationGuard(request);if(guard)return guard;
 const auth=await roleSession('ADMIN');if(auth.response)return auth.response;
 let body:unknown;try{body=await readBody(request);}catch{return failure('Geçersiz istek.',400);}
 const parsed=reviewRequestSchema.safeParse(body);if(!parsed.success)return failure('Karar ve gerekçeyi kontrol edin.',422);
 const {data,error}=await auth.client.rpc('review_athlete_request',{request_id:parsed.data.id,decision:parsed.data.decision,existing_athlete:parsed.data.existing_athlete??null,review_message:parsed.data.review_message??null});
 if(error){if(error.code==='PGRST202')return setupFailure();if(error.code==='40001')return failure('Talep daha önce değerlendirildi. Listeyi yenileyin.',409);if(error.code==='P0002')return failure('Talep bulunamadı.',404);return databaseFailure(error);}
 return NextResponse.json({athlete_id:data},{headers:{'Cache-Control':'no-store'}});
}
