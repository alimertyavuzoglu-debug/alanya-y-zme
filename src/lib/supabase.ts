import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function validConfiguration(urlValue?: string, key?: string) {
  if (!urlValue || !key || key.startsWith('sb_secret_')) return false;
  try {
    const url = new URL(urlValue);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) return false;
    if (key.startsWith('sb_publishable_')) return key.length > 20;
    // Legacy anon JWTs are public keys; service_role JWTs are never accepted.
    const payload = JSON.parse(Buffer.from(key.split('.')[1] ?? '', 'base64url').toString('utf8'));
    return payload.role === 'anon';
  } catch { return false; }
}

export function configurationPresent() {
  return validConfiguration(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

export async function supabase() {
  if (!configurationPresent()) throw new Error('SUPABASE_NOT_CONFIGURED');
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (items: { name: string; value: string; options: CookieOptions }[]) => items.forEach(({ name, value, options }) =>
          store.set(name, value, { ...options, httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' })),
      },
    },
  );
}
