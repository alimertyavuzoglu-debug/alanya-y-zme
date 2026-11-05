import {NextResponse} from 'next/server';import {z} from 'zod';
import {roleSession,setupFailure} from '@/lib/role-session';
import {databaseFailure,failure,mutationGuard,readBody} from '@/lib/http';
import {athleteRequestSchema} from '@/lib/coach-workflow';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const auth=await roleSession('COACH');if(auth.response)return auth.response;
 const page=z.coerce.number().int().min(0).max(10000).safeParse(new URL(request.url).searchParams.get('page')??0);if(!page.success)return failure('Geçersiz sayfa.',400);
 const {data,error}=await auth.client.from('athlete_requests').select('*').eq('coach_id',auth.user.id).order('created_at',{ascending:false}).order('id').range(page.data*50,page.data*50+49);
 if(error)return error.code==='PGRST205'?setupFailure():databaseFailure(error);
 return NextResponse.json({data},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(request:Request){
 const guard=mutationGuard(request);if(guard)return guard;
 const auth=await roleSession('COACH');if(auth.response)return auth.response;
 let body:unknown;try{body=await readBody(request);}catch{return failure('Geçersiz istek.',400);}
 const parsed=athleteRequestSchema.safeParse(body);if(!parsed.success)return failure('Sporcu ve grup bilgilerini kontrol edin.',422);
 const {data,error}=await auth.client.from('athlete_requests').insert(parsed.data).select('id').single();
 if(error)return error.code==='PGRST205'?setupFailure():databaseFailure(error);
 return NextResponse.json({data},{status:201,headers:{'Cache-Control':'no-store'}});
}
