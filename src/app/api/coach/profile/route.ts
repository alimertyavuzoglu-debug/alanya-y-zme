import {NextResponse} from 'next/server';
import {roleSession,setupFailure} from '@/lib/role-session';
import {databaseFailure,failure,mutationGuard,readBody} from '@/lib/http';
import {coachProfileSchema} from '@/lib/coach-workflow';
export const dynamic='force-dynamic';
export async function GET(){
 const auth=await roleSession('COACH');if(auth.response)return auth.response;
 const {data,error}=await auth.client.from('coach_profiles').select('phone,city,specialization,bio,avatar_path').eq('user_id',auth.user.id).maybeSingle();
 if(error)return error.code==='PGRST205'?setupFailure():databaseFailure(error);
 const {data:profile,error:profileError}=await auth.client.from('profiles').select('display_name').eq('id',auth.user.id).single();
 if(profileError)return databaseFailure(profileError);
 let avatar_url:null|string=null;
 if(data?.avatar_path){const signed=await auth.client.storage.from('coach-avatars').createSignedUrl(data.avatar_path,3600);avatar_url=signed.data?.signedUrl??null;}
 return NextResponse.json({data:{display_name:profile.display_name,email:auth.user.email??'',phone:data?.phone??null,city:data?.city??null,specialization:data?.specialization??null,bio:data?.bio??null,avatar_path:data?.avatar_path??null,avatar_url}},{headers:{'Cache-Control':'no-store'}});
}
export async function PUT(request:Request){
 const guard=mutationGuard(request);if(guard)return guard;
 const auth=await roleSession('COACH');if(auth.response)return auth.response;
 let body:unknown;try{body=await readBody(request);}catch{return failure('Geçersiz istek.',400);}
 const parsed=coachProfileSchema.safeParse(body);if(!parsed.success)return failure('Profil alanlarını ve telefonu kontrol edin.',422);
 const {error}=await auth.client.rpc('save_my_coach_profile',{payload:parsed.data});
 if(error)return error.code==='PGRST202'?setupFailure():databaseFailure(error);
 return NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});
}
