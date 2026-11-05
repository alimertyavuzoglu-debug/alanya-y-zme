import { NextResponse } from 'next/server';
import { authenticated, databaseFailure, failure, mutationGuard, readBody } from '@/lib/http';
import { resourceDefinition } from '@/lib/resources';
import { z } from 'zod';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ resource: string }> };

export async function GET(request: Request, context: Context) {
  const { resource } = await context.params;
  const definition = resourceDefinition(resource);
  if (!definition) return failure('Kaynak bulunamadı.', 404);
  const auth = await authenticated();
  if (auth.response) return auth.response;
  const url = new URL(request.url);
  const page = z.coerce.number().int().min(0).max(10000).safeParse(url.searchParams.get('page') ?? 0);
  if (!page.success) return failure('Geçersiz sayfa.', 400);
  let query = auth.client.from(resource).select('*').order(definition.keys[0]).range(page.data * 50, page.data * 50 + 49);
  // Whitelisted exact filters only; no user-controlled SQL or PostgREST expressions.
  for (const key of definition.keys) {
    const value = url.searchParams.get(key);
    if (value) {
      if (!z.string().uuid().safeParse(value).success) return failure('Geçersiz kimlik.', 400);
      query = query.eq(key, value);
    }
  }
  const secondaryKey = definition.keys.at(1);
  if (secondaryKey) query = query.order(secondaryKey);
  const { data, error } = await query;
  if (error) return databaseFailure(error);
  return NextResponse.json({ data, page: page.data }, { headers: { 'Cache-Control': 'no-store' } });
}

async function write(request: Request, context: Context, patch: boolean) {
  const guard = mutationGuard(request);
  if (guard) return guard;
  const { resource } = await context.params;
  const definition = resourceDefinition(resource);
  if (!definition) return failure('Kaynak bulunamadı.', 404);
  const auth = await authenticated();
  if (auth.response) return auth.response;
  let raw: unknown;
  try { raw = await readBody(request); } catch { return failure('Geçersiz veya fazla büyük JSON.', 400); }
  const schema = patch ? definition.schema.partial() : definition.schema;
  const parsed = schema.safeParse(raw);
  if (!parsed.success || Object.keys(parsed.data).length === 0) return failure('Alanlar eksik veya geçersiz.', 422);
  let query;
  if (patch) {
    const url = new URL(request.url);
    let update = auth.client.from(resource).update(parsed.data);
    for (const key of definition.keys) {
      const value = url.searchParams.get(key);
      if (!z.string().uuid().safeParse(value).success) return failure('Güncelleme için kayıt kimliği gerekli.', 400);
      update = update.eq(key, value);
    }
    query = update.select('*');
  } else query = auth.client.from(resource).insert(parsed.data).select('*');
  const { data, error } = await query;
  if (error) return databaseFailure(error);
  if (!data?.length) return failure('Kayıt bulunamadı veya erişim izniniz yok.', 404);
  return NextResponse.json({ data }, { status: patch ? 200 : 201, headers: { 'Cache-Control': 'no-store' } });
}
export const POST = (request: Request, context: Context) => write(request, context, false);
export const PATCH = (request: Request, context: Context) => write(request, context, true);
