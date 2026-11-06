import data from '@/data/public-pages.json';
export type PublicPageContent={path:string;title:string;intro:string;description:string;body:string;image:string;images:string[];language:string};
export type PageOverride={title:string;intro:string;body:string;image:string};
const pages:Record<string,PublicPageContent>={...data.pages,'/basvuru':{path:'/basvuru',title:'Deneme dersine başvurun',intro:'Size veya çocuğunuza uygun programı birlikte belirleyelim.',description:'Alanya Deniz Aslanları deneme dersi başvuru formu.',body:'',image:'/legacy/images/galeri/havuz-cocuklar.webp',images:[],language:'tr'}};
export const publicPages=Object.values(pages);
export const courses=data.courses;
export function getPublicPage(path:string){return Object.hasOwn(pages,path)?pages[path]:null;}
export function pageImage(page:PublicPageContent){return page.image|| (page.path.includes('triatlon')?'/images/triathlon.png':'/legacy/images/galeri/havuz-cocuklar.webp');}
export function resolvePage(page:PublicPageContent,override?:PageOverride):PublicPageContent{return override?{...page,...override}:page;}
export const contactDetails={address:'100. Yıl Recep Hacıfazlıoğlu Spor Salonu',district:'Oba, Alanya / Antalya',weekdays:'05:00–20:00',weekend:'08:00–15:00',pool:'25 metre · Yarı olimpik kapalı havuz',map:'https://www.google.com/maps/search/?api=1&query=100.+Y%C4%B1l+Recep+Hac%C4%B1fazl%C4%B1o%C4%9Flu+Spor+Salonu,+Alanya',federation:'https://portal.triatlon.org.tr/en/club/view/alanya-deniz-aslanlar-spor-kulubu/'};
