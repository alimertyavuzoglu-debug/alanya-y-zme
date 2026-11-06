import type { NextConfig } from 'next';
const config: NextConfig = {
  poweredByHeader: false,
  async redirects() {
    const publicHost = [{ type: 'host' as const, value: '(?:www\\.)?alanyadenizaslanlarisk\\.com' }];
    return [{
      source: '/:path*',
      has: [{ type: 'host', value: 'alanyadenizaslanlari\\.netlify\\.app' }],
      destination: 'https://panel.alanyadenizaslanlarisk.com/:path*',
      permanent: true,
    }, {
      source: '/',
      has: [{ type: 'host', value: 'panel\\.alanyadenizaslanlarisk\\.com' }],
      destination: '/login',
      permanent: false,
    }, ...['/login', '/admin', '/coach', '/invite/:path*', '/auth/:path*'].map(source => ({
      source,
      has: publicHost,
      destination: `https://panel.alanyadenizaslanlarisk.com${source}`,
      permanent: false,
    })), ...[
      ['/hakkimizda', '/#kulup'],
      ['/kadro', '/#antrenorler'],
      ['/iletisim', '/#iletisim'],
      ['/programlar', '/#egitimler'],
      ['/programlar/:path*', '/#egitimler'],
    ].map(([source, destination]) => ({ source, destination, permanent: false }))];
  },
  async headers() {
    return [{ source: '/(.*)', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Frame-Options', value: 'DENY' },
    ] }, { source: '/invite/:path*', headers: [
      { key: 'Referrer-Policy', value: 'no-referrer' },
      { key: 'Cache-Control', value: 'no-store' },
      { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
    ] }, { source: '/auth/callback', headers: [
      { key: 'Referrer-Policy', value: 'no-referrer' },
      { key: 'Cache-Control', value: 'no-store' },
    ] }];
  },
};
export default config;
