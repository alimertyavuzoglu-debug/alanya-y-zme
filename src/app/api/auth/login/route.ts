import { NextResponse } from 'next/server';
import { z } from 'zod';
import { configurationPresent, supabase } from '@/lib/supabase';
import { failure, mutationGuard, readBody } from '@/lib/http';
export async function POST(request: Request) {
  const guard = mutationGuard(request); if (guard) return guard;
  if (!configurationPresent()) return failure('Supabase bağlantısı yapılandırılmadı.', 503);
  let body: unknown;
  try { body = await readBody(request); } catch { return failure('Geçersiz istek.', 400); }
  const parsed = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(256) }).strict().safeParse(body);
  if (!parsed.success) return failure('E-posta ve parola gerekli.', 422);
  const client = await supabase();
  const { error } = await client.auth.signInWithPassword(parsed.data);
  if (error) return failure('Giriş yapılamadı. Bilgilerinizi kontrol edin.', 401);
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
