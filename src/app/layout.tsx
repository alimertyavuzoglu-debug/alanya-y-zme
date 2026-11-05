import './globals.css';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Deniz Aslanları | Kulüp Yönetimi' };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="tr"><body>{children}</body></html>;
}
