import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {localizeContent} from '@/lib/public-i18n';
import {routeInfo,languageAlternates} from '@/lib/public-locale';
import PublicSite from '@/components/public-site';
import {getPublicPage,resolvePage} from '@/lib/public-pages';
import {publicContent} from '@/lib/public-content';
import {PUBLIC_SITE_ORIGIN} from '@/lib/site-addresses';
import PublicSubpage from '@/components/public-subpage';
export const dynamic='force-dynamic';
type Props={params:Promise<{slug:string[]}>};
export async function generateMetadata({params}:Props):Promise<Metadata>{
 const path='/'+(await params).slug.join('/'),{locale,canonical}=routeInfo(path);const c=localizeContent(await publicContent(),locale);
 const original=getPublicPage(path);if(!original&&canonical!=='/')return {};
 const page=original?resolvePage(original,c.pageOverrides[path]):null;
 return {title:page?`${page.title} | Alanya Deniz Aslanları`:`${c.brand} | ${c.brandSubtitle}`,description:page?(page.intro||page.description):c.heroDescription,alternates:{canonical:PUBLIC_SITE_ORIGIN+path,languages:Object.fromEntries(Object.entries(languageAlternates(canonical)).map(([locale,path])=>[locale,PUBLIC_SITE_ORIGIN+path]))}};
}
export default async function Page({params}:Props){
 const path='/'+(await params).slug.join('/'),{locale,canonical}=routeInfo(path);const original=getPublicPage(path);if(!original&&canonical!=='/')notFound();
 const c=localizeContent(await publicContent(),locale);
 if(canonical==='/')return <PublicSite content={c} locale={locale}/>;
 const page=resolvePage(original!,c.pageOverrides[path]);return <PublicSubpage content={c} page={page} originalBody={original!.body}/>;
}
