import 'server-only';
import {cache} from 'react';
import {createClient} from '@supabase/supabase-js';
import {configurationPresent} from './supabase';
import {defaultContent,resolveContent} from './site-content';
export const publicContent=cache(async()=>{
 if(!configurationPresent())return defaultContent;
 const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false},db:{retry:false},global:{fetch:(input,init)=>fetch(input,{...init,cache:'no-store'})}});
 try{
  const {data,error}=await client.from('site_content').select('content').eq('key','homepage').abortSignal(AbortSignal.timeout(4000)).single();
  if(error)return defaultContent;
  const parsed=resolveContent(data.content);return parsed.success?parsed.data:defaultContent;
 }catch{return defaultContent;}
});
