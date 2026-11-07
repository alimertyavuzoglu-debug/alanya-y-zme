import { NextResponse } from 'next/server';
import {loginSchema,loginFailure} from '@/lib/login';
import { configurationPresent, supabase } from '@/lib/supabase';
import { failure, mutationGuard, readBody } from '@/lib/http';
export async function POST(request: Request) {
  const guard = mutationGuard(request); if (guard) return guard;
  if (!configurationPresent()) return failure('Supabase bağlantısı yapılandırılmadı.', 503);
  let body: unknown;
  try { body = await readBody(request); } catch { return failure('Geçersiz istek.', 400); }
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return failure('Geçerli bir e-posta adresi ve parola girin.', 422);
  const client = await supabase();
  try {
    const {error}=await client.auth.signInWithPassword(parsed.data);
    if(error){const problem=loginFailure(error);return failure(problem.message,problem.status);}
  } catch {
    const problem=loginFailure({});return failure(problem.message,problem.status);
  }
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
