import type {MetadataRoute} from 'next';
import {PUBLIC_SITE_ORIGIN} from '@/lib/site-addresses';
export default function robots():MetadataRoute.Robots{return {rules:{userAgent:'*',allow:'/',disallow:['/admin','/coach','/api/','/login','/invite/','/auth/','/onizleme']},sitemap:PUBLIC_SITE_ORIGIN+'/sitemap.xml'};}
