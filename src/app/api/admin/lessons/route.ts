import {NextResponse} from 'next/server';
import {roleSession,setupFailure} from '@/lib/role-session';
import {databaseFailure,failure,mutationGuard,readBody} from '@/lib/http';
import {lessonBundleSchema} from '@/lib/coach-workflow';
export async function POST(request:Request){
 const guard=mutationGuard(request);if(guard)return guard;
 const auth=await roleSession('ADMIN');if(auth.response)return auth.response;
 let body:unknown;try{body=await readBody(request);}catch{return failure('Geçersiz istek.',400);}
 const parsed=lessonBundleSchema.safeParse(body);if(!parsed.success)return failure('Ders tarihlerini, antrenörü ve sporcu seçimini kontrol edin.',422);
 const {data,error}=await auth.client.rpc('create_lesson_bundle',{payload:parsed.data});
 if(error)return error.code==='PGRST202'?setupFailure():databaseFailure(error);
 return NextResponse.json({data},{status:201,headers:{'Cache-Control':'no-store'}});
}
