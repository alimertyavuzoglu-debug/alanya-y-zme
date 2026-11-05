import { NextResponse } from 'next/server';
import { configurationPresent, supabase } from './supabase';

export function failure(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function mutationGuard(request: Request) {
  const origin = request.headers.get('origin');
  // Cookie-authenticated writes require an explicit same-origin request.
  const url = new URL(request.url);
  const expectedOrigin = process.env.APP_ORIGIN ?? `${url.protocol}//${request.headers.get('host') ?? url.host}`;
  if (!origin || origin !== expectedOrigin) return failure('İstek kaynağı doğrulanamadı.', 403);
  if (!request.headers.get('content-type')?.startsWith('application/json')) return failure('JSON gerekli.', 415);
  return null;
}

export async function readBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('INVALID_BODY');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const item = await reader.read();
    if (item.done) break;
    size += item.value.byteLength;
    if (size > 32768) { await reader.cancel(); throw new Error('BODY_TOO_LARGE'); }
    chunks.push(item.value);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}

export async function authenticated() {
  if (!configurationPresent()) return { response: failure('Supabase bağlantısı yapılandırılmadı.', 503) };
  const client = await supabase();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return { response: failure('Oturum açmanız gerekiyor.', 401) };
  const { data: profile } = await client.from('profiles').select('is_active').eq('id', data.user.id).single();
  if (!profile?.is_active) return { response: failure('Hesap aktif değil veya kulüp hesabı tanımlanmamış.', 403) };
  return { client, user: data.user };
}

export function databaseFailure(error: { code?: string; message?: string }) {
  if (error.code === '42501') return failure('Bu işlem için yetkiniz yok.', 403);
  if (error.code === '23505') return failure('Bu kayıt zaten mevcut.', 409);
  if (['23503', '23514', '22P02'].includes(error.code ?? '')) {
    const messages: Record<string,string> = {
      'Overlapping enrollment':'Bu sporcu için aynı dönemde çakışan bir kayıt var.',
      'Enrollment outside term':'Sporcu kayıt tarihleri dönem sınırları içinde olmalı.',
      'Assignment outside term':'Antrenör görev tarihleri dönem sınırları içinde olmalı.',
      'Schedule outside term':'Program tarihleri dönem sınırları içinde olmalı.',
      'Lesson outside term':'Ders tarihleri dönem sınırları içinde olmalı.',
      'Existing records outside new term dates':'Yeni dönem tarihleri mevcut ders veya kayıtları kapsamıyor.',
      'Coach has overlapping lesson':'Antrenörün bu saatlerde başka bir dersi var.',
      'Coach is not assigned to term':'Antrenör bu dönem ve ders tarihinde görevli değil.',
      'Invalid lesson membership':'Sporcunun bu dönem ve ders tarihi için geçerli kaydı yok.',
      'Cannot mark cancelled or future lesson':'İptal edilmiş veya henüz başlamamış derse yoklama girilemez.',
      'Assigned lesson time is locked; cancel and create a replacement':'Atanmış dersin saatini değiştirmek için dersi iptal edip yeni ders oluşturun.',
      'Membership change invalidates a lesson roster':'Bu tarih değişikliği mevcut dersin sporcu kaydını geçersiz kılıyor.',
      'Assignment change invalidates a lesson':'Bu tarih değişikliği mevcut dersin antrenör görevini geçersiz kılıyor.',
      'Plan belongs to another term':'Seçilen antrenman planı başka bir döneme ait.',
    };
    return failure(messages[error.message??''] ?? 'Kayıt ilişkileri veya tarih aralığı geçersiz. Alanları kontrol edin.',422);
  }
  return failure('Veritabanı işlemi tamamlanamadı.', 500);
}
