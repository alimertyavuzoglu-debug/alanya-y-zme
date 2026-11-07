import type {MetadataRoute} from 'next';
import {PUBLIC_SITE_ORIGIN} from '@/lib/site-addresses';
import {publicPages} from '@/lib/public-pages';
export default function sitemap():MetadataRoute.Sitemap{return [{url:PUBLIC_SITE_ORIGIN,priority:1},{url:PUBLIC_SITE_ORIGIN+'/en',priority:.9},{url:PUBLIC_SITE_ORIGIN+'/ru',priority:.9},...publicPages.map(p=>({url:PUBLIC_SITE_ORIGIN+p.path,priority:.7}))];}
