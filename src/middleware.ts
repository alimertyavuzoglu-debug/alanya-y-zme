import {NextResponse,type NextRequest} from 'next/server';
export function middleware(request:NextRequest){const headers=new Headers(request.headers);headers.set('x-das-locale',request.nextUrl.pathname.startsWith('/ru')?'ru':'en');return NextResponse.next({request:{headers}});}
export const config={matcher:['/en/:path*','/ru/:path*']};
