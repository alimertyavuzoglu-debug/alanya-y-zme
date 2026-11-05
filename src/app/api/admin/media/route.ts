import {NextResponse} from 'next/server';
import {expectedOrigin} from '@/lib/origin';
import {randomUUID} from 'node:crypto';
import {authenticated,databaseFailure,failure} from '@/lib/http';
export async function POST(request:Request){
 const expected=expectedOrigin(request);
 if(!expected||request.headers.get('origin')!==expected)return failure('İstek kaynağı doğrulanamadı.',403);
 const auth=await authenticated();if(auth.response)return auth.response;
 const {data:roles,error}=await auth.client.from('user_roles').select('role').eq('user_id',auth.user.id);
 if(error)return databaseFailure(error);
 if(!roles.some(r=>r.role==='ADMIN'))return failure('Yönetici yetkisi gerekli.',403);
 const reader=request.body?.getReader();if(!reader)return failure('Görsel gerekli.',400);
 let size=0;const chunks:Uint8Array[]=[];
 while(true){const item=await reader.read();if(item.done)break;size+=item.value.byteLength;if(size>5*1024*1024){await reader.cancel();return failure('Görsel en fazla 5 MB olabilir.',413);}chunks.push(item.value);}
 const bytes=Buffer.concat(chunks);
 const format=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'png':bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'jpg':bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'?'webp':null;
 if(!format)return failure('Yalnızca PNG, JPEG veya WebP görseli yükleyin.',415);
 const path=`${auth.user.id}/${randomUUID()}.${format}`;
 const {error:uploadError}=await auth.client.storage.from('site-media').upload(path,bytes,{contentType:format==='jpg'?'image/jpeg':`image/${format}`,upsert:false,cacheControl:'31536000'});
 if(uploadError)return failure('Görsel yüklenemedi. Site içeriği kurulumu ve Storage izinlerini kontrol edin.',503);
 return NextResponse.json({url:auth.client.storage.from('site-media').getPublicUrl(path).data.publicUrl},{status:201,headers:{'Cache-Control':'no-store'}});
}
