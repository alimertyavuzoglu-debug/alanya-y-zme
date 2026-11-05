import {failure} from './http';
export async function readImage(request:Request,max:number){
 const reader=request.body?.getReader();if(!reader)return {response:failure('Görsel gerekli.',400)};
 const chunks:Uint8Array[]=[];let size=0;
 while(true){const item=await reader.read();if(item.done)break;size+=item.value.byteLength;if(size>max){await reader.cancel();return {response:failure(`Görsel en fazla ${Math.floor(max/1048576)} MB olabilir.`,413)};}chunks.push(item.value);}
 const bytes=Buffer.concat(chunks);
 const extension=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'png':bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'jpg':bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'?'webp':null;
 if(!extension)return {response:failure('PNG, JPEG veya WebP görseli yükleyin.',415)};
 return {bytes,extension,mime:extension==='jpg'?'image/jpeg':`image/${extension}`};
}
