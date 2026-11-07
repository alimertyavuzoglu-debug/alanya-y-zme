import strings from '@/data/public-ui-translations.json';
import type {PublicLocale} from './public-locale';
const dictionaries:Record<string,Record<string,string>>=strings;
export function translator(locale:PublicLocale){return (text:string)=>locale==='tr'?text:(dictionaries[locale]?.[text]??text);}

import type {SiteContent} from './site-content';
export function localizeContent(content:SiteContent,locale:PublicLocale):SiteContent{
 if(locale==='tr')return content;
 const t=translator(locale),result={...content};
 for(const key of Object.keys(content) as (keyof SiteContent)[]){const value=content[key];if(typeof value==='string'&&!key.endsWith('Image')&&key!=='phone'&&key!=='brand')Object.assign(result,{[key]:content.localizedText?.[locale]?.[key]??t(value)});}
 return result;
}
