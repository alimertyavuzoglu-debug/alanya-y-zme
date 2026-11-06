import { z } from 'zod';
import {getPublicPage} from './public-pages';
const short=z.string().trim().min(1).max(160);
const paragraph=z.string().trim().min(1).max(1200);
const image=z.string().max(1500).refine(v=>/^\/(?:images|legacy\/images)\/[a-zA-Z0-9/_\-.]+$/.test(v)||(()=>{try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}})(),'Yerel görsel yolu veya HTTPS adresi gerekli.');
const pageOverride=z.object({title:z.string().trim().min(1).max(240),intro:z.string().trim().max(1600),body:z.string().max(16000),image}).strict();
export const contentSchema=z.object({
 brand:short,brandSubtitle:short,navAbout:short,navPrograms:short,navCoaches:short,navContact:short,navLogin:short,
 eyebrow:short,heroTitle:z.string().trim().min(1).max(140),heroDescription:paragraph,primaryCta:short,secondaryCta:short,
 heroImage:image,heroAlt:short,introTitle:short,
 swimTitle:short,swimDescription:paragraph,swimImage:image,swimAlt:short,
 triTitle:short,triDescription:paragraph,triImage:image,triAlt:short,
 aboutTitle:short,aboutDescription:paragraph,coachesTitle:short,coachesDescription:paragraph,
 contactTitle:short,contactDescription:paragraph,phone:z.string().regex(/^\+[1-9]\d{7,14}$/),footerText:short,
 pageOverrides:z.unknown().refine(v=>!v||typeof v!=='object'||Object.keys(v).every(path=>Boolean(getPublicPage(path))),'Geçersiz sayfa.').pipe(z.record(pageOverride)).refine(v=>Object.keys(v).length<=60&&Object.keys(v).every(path=>Boolean(getPublicPage(path))),'Geçersiz sayfa.').default({}),
}).strict();
export type SiteContent=z.infer<typeof contentSchema>;
export const defaultContent:SiteContent={
 brand:'DENİZ ASLANLARI',brandSubtitle:'YÜZME & TRİATLON KULÜBÜ',navAbout:'Kulübümüz',navPrograms:'Eğitimler',navCoaches:'Antrenörler',navContact:'İletişim',navLogin:'Kulüp girişi',
 eyebrow:'ALANYA · YÜZME & TRİATLON',heroTitle:'Birlikte daha güçlü.\nSuda ve hayatta.',heroDescription:'Alanya’da yüzme ve triatlon eğitimleriyle yeni hedeflere.',primaryCta:'Deneme dersine başvur',secondaryCta:'Kulübü tanıyın',heroImage:'/images/hero.png',heroAlt:'Havuzda yüzme tekniği çalışan sporcu ve antrenör',introTitle:'Sadece antrenman değil, bir kulüp.',
 swimTitle:'Yüzme eğitimleri',swimDescription:'Çocuklardan yetişkinlere, güvenli ve planlı yüzme eğitimleri.',swimImage:'/images/swimming.png',swimAlt:'Havuz kenarında antrenörüyle çalışan yüzücü',
 triTitle:'Triatlon antrenmanları',triDescription:'Yüzme, bisiklet ve koşu disiplinlerini bir arada geliştiren planlı antrenmanlar.',triImage:'/images/triathlon.png',triAlt:'Alanya sahilinde bisiklet antrenmanı yapan sporcular',
 aboutTitle:'Suya güvenle, hedeflere birlikte.',aboutDescription:'Deniz Aslanları’nda yüzme ve triatlon etrafında buluşuyoruz. Seviyenize ve hedefinize uygun eğitim seçenekleri için bizimle iletişime geçin.',coachesTitle:'Antrenörünüzle birlikte gelişin.',coachesDescription:'Eğitim yaklaşımımızı, ders gruplarını ve antrenörlerimizi tanımak için kulübümüzle görüşün.',
 contactTitle:'İlk adımı birlikte atalım.',contactDescription:'Deneme dersi, güncel programlar ve grup seçenekleri hakkında bilgi almak için bizi arayın.',phone:'+905459477973',footerText:'Alanya · Yüzme & Triatlon',
 pageOverrides:{},
};
export function resolveContent(value:unknown){return contentSchema.safeParse({...defaultContent,...(value&&typeof value==='object'?value:{})});}
