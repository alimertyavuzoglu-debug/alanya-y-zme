import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {getPublicPage,resolvePage} from '@/lib/public-pages';
import {publicContent} from '@/lib/public-content';
import {PUBLIC_SITE_ORIGIN} from '@/lib/site-addresses';
import PublicSubpage from '@/components/public-subpage';
export const dynamic='force-dynamic';
type Props={params:Promise<{slug:string[]}>};
export async function generateMetadata({params}:Props):Promise<Metadata>{
 const path='/'+(await params).slug.join('/');const original=getPublicPage(path);if(!original)return {};
 const c=await publicContent(),page=resolvePage(original,c.pageOverrides[path]);
 return {title:`${page.title} | Alanya Deniz Aslanları`,description:page.intro||page.description,alternates:{canonical:PUBLIC_SITE_ORIGIN+path}};
}
export default async function Page({params}:Props){
 const path='/'+(await params).slug.join('/');const original=getPublicPage(path);if(!original)notFound();
 const c=await publicContent(),page=resolvePage(original,c.pageOverrides[path]);
 return <PublicSubpage content={c} page={page} originalBody={original.body}/>;
}
