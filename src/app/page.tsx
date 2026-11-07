import type {Metadata} from 'next';
import {PUBLIC_SITE_ORIGIN} from '@/lib/site-addresses';
import PublicSite from '@/components/public-site';
import {publicContent} from '@/lib/public-content';
export const metadata:Metadata={title:'Alanya Deniz Aslanları | Yüzme ve Triatlon',alternates:{canonical:PUBLIC_SITE_ORIGIN,languages:{tr:PUBLIC_SITE_ORIGIN,en:PUBLIC_SITE_ORIGIN+'/en',ru:PUBLIC_SITE_ORIGIN+'/ru'}}};
export const dynamic='force-dynamic';
export default async function Page(){return <PublicSite content={await publicContent()}/>;}
