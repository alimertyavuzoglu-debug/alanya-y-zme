import {NextResponse} from 'next/server';
import {randomUUID} from 'node:crypto';
import {roleSession} from '@/lib/role-session';
import {expectedOrigin} from '@/lib/origin';
import {failure} from '@/lib/http';
import {readImage} from '@/lib/upload-image';
export async function POST(request:Request){
 const origin=expectedOrigin(request);if(!origin||origin!==request.headers.get('origin'))return failure('İstek kaynağı doğrulanamadı.',403);
 const auth=await roleSession('COACH');if(auth.response)return auth.response;
 const image=await readImage(request,3*1048576);if(image.response)return image.response;
 const path=`${auth.user.id}/${randomUUID()}.${image.extension}`;
 const {error}=await auth.client.storage.from('coach-avatars').upload(path,image.bytes,{contentType:image.mime,upsert:false,cacheControl:'3600'});
 if(error)return failure('Fotoğraf yüklenemedi. 005 kurulumu ve Storage izinlerini kontrol edin.',503);
 const signed=await auth.client.storage.from('coach-avatars').createSignedUrl(path,3600);
 return NextResponse.json({path,url:signed.data?.signedUrl??null},{status:201,headers:{'Cache-Control':'no-store'}});
}
