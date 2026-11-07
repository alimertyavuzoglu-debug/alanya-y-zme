import './globals.css';
import {headers} from 'next/headers';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Deniz Aslanları | Kulüp Yönetimi' };
export default async function Layout({ children }: { children: React.ReactNode }) {
  const requested=(await headers()).get('x-das-locale');const locale=requested==='ru'||requested==='en'?requested:'tr';
  return <html lang={locale}><body>{children}</body></html>;
}
