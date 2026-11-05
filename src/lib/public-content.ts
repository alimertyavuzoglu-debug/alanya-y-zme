import 'server-only';
import {createClient} from '@supabase/supabase-js';
import {configurationPresent} from './supabase';
import {defaultContent,resolveContent} from './site-content';
export async function publicContent(){
 if(!configurationPresent())return defaultContent;
 const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,cache:'no-store',signal:AbortSignal.timeout(4000)})}});
 try{
  const {data,error}=await client.from('site_content').select('content').eq('key','homepage').single();
  if(error)return defaultContent;
  const parsed=resolveContent(data.content);return parsed.success?parsed.data:defaultContent;
 }catch{return defaultContent;}
}
