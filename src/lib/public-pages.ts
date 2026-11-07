import data from '@/data/public-pages.json';
import translations from '@/data/public-translations.json';
import {localizedPath} from './public-locale';
export type PublicPageContent={path:string;title:string;intro:string;description:string;body:string;image:string;images:string[];language:string};
export type PageOverride={title:string;intro:string;body:string;image:string};
const pages:Record<string,PublicPageContent>=Object.fromEntries(Object.entries(data.pages).filter(([,page])=>page.language==='tr'));
pages['/basvuru']={path:'/basvuru',title:'Deneme dersine başvurun',intro:'Size veya çocuğunuza uygun programı birlikte belirleyelim.',description:'Alanya Deniz Aslanları deneme dersi başvuru formu.',body:'',image:'/legacy/images/galeri/havuz-cocuklar.webp',images:[],language:'tr'};
for(const locale of ['en','ru'] as const)for(const [canonical,page] of Object.entries(translations[locale])){const path=localizedPath(canonical,locale);pages[path]={...page,path,language:locale};}
export const publicPages=Object.values(pages);
export const courses=data.courses;
export function getPublicPage(path:string){return Object.hasOwn(pages,path)?pages[path]:null;}
export function pageImage(page:PublicPageContent){return page.image|| (page.path.includes('triatlon')?'/images/triathlon.png':'/legacy/images/galeri/havuz-cocuklar.webp');}
export function resolvePage(page:PublicPageContent,override?:PageOverride):PublicPageContent{return override?{...page,...override}:page;}
export const contactDetails={email:'alanyadenizaslanlarisporklubu@gmail.com',instagram:'https://www.instagram.com/denizaslanlariyuzme/',instagramUsername:'@denizaslanlariyuzme',address:'100. Yıl Recep Hacıfazlıoğlu Spor Salonu',district:'Oba, Alanya / Antalya',weekdays:'05:00–20:00',weekend:'08:00–15:00',pool:'25 metre · Yarı olimpik kapalı havuz',map:'https://www.google.com/maps/search/?api=1&query=100.+Y%C4%B1l+Recep+Hac%C4%B1fazl%C4%B1o%C4%9Flu+Spor+Salonu,+Alanya',federation:'https://portal.triatlon.org.tr/en/club/view/alanya-deniz-aslanlar-spor-kulubu/'};
