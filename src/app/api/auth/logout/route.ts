import { NextResponse } from 'next/server';
import { failure, mutationGuard } from '@/lib/http';
import { configurationPresent, supabase } from '@/lib/supabase';
export async function POST(request: Request) {
 const guard=mutationGuard(request); if(guard)return guard;
 if(!configurationPresent())return failure('Supabase bağlantısı yapılandırılmadı.',503);
 const client=await supabase();
 const {error}=await client.auth.signOut();
 if(error)return failure('Çıkış yapılamadı.',500);
 return NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});
}
