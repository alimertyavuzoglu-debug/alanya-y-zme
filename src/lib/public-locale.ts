export const locales=['tr','en','ru'] as const;
export type PublicLocale=typeof locales[number];
export const localeNames={tr:'Türkçe',en:'English',ru:'Русский'};
const routes:Record<string,string>={'/':'','/hakkimizda':'/about','/iletisim':'/contact','/kadro':'/coaches','/programlar':'/programmes','/basarilarimiz':'/achievements','/lokasyonlar':'/locations','/veli-bilgilendirme':'/parents','/duyurular':'/news','/gizlilik':'/privacy','/kvkk-aydinlatma-metni':'/kvkk','/cerez-politikasi':'/cookies','/basvuru':'/apply','/blog':'/blog'};
export function routeInfo(path:string):{locale:PublicLocale;canonical:string}{
 const match=/^\/(en|ru)(\/.*)?$/.exec(path);
 if(!match)return {locale:'tr',canonical:path==='/'?'/':path.replace(/\/$/,'')};
 const rest=match[2]||'';let canonical=rest||'/';
 for(const [tr,other] of Object.entries(routes).sort((a,b)=>b[1].length-a[1].length)){if(other&&(rest===other||rest.startsWith(other+'/'))){canonical=tr+rest.slice(other.length);break;}}
 return {locale:match[1] as PublicLocale,canonical};
}
export function localizedPath(path:string,locale:PublicLocale):string{
 if(!path.startsWith('/')||path.startsWith('//'))return path;
 const {canonical}=routeInfo(path);if(locale==='tr')return canonical;
 for(const [tr,other] of Object.entries(routes).sort((a,b)=>b[0].length-a[0].length))if(canonical===tr||(tr!=='/'&&canonical.startsWith(tr+'/')))return '/'+locale+other+canonical.slice(tr.length);
 return path;
}
export function languageAlternates(path:string){return Object.fromEntries(locales.map(locale=>[locale,localizedPath(path,locale)]));}
