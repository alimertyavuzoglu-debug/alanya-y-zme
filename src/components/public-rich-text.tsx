import {localizedPath,type PublicLocale} from '@/lib/public-locale';
import {translator} from '@/lib/public-i18n';
import {Fragment,type ReactNode} from 'react';
import {publicHref,publicImage} from '@/lib/public-markup';
function inline(text:string,locale:PublicLocale):ReactNode[]{
 const parts:ReactNode[]=[];const expression=/\[([^\]]+)\]\(([^\s)]+)\)|\*\*([^*]+)\*\*/g;let at=0;let match:RegExpExecArray|null;
 while((match=expression.exec(text))){if(match.index>at)parts.push(text.slice(at,match.index));
  if(match[3])parts.push(<strong key={match.index}>{match[3]}</strong>);
  else {let href=publicHref(localizedPath(match[2],locale));if(href&&locale!=='tr'){try{const url=new URL(href);if(url.hostname==='wa.me'&&url.searchParams.has('text')){url.searchParams.set('text',translator(locale)(url.searchParams.get('text')!));href=url.toString();}}catch{}}parts.push(href?<a key={match.index} href={href} {...(href.startsWith('https:')?{target:'_blank',rel:'noopener noreferrer'}:{})}>{match[1]}</a>:match[1]);}
  at=expression.lastIndex;
 }if(at<text.length)parts.push(text.slice(at));return parts;
}
export default function PublicRichText({text,locale='tr'}:{text:string;locale?:PublicLocale}){const t=translator(locale);
 return <div className="public-rich-text">{text.split(/\n\s*\n/).map((block,i)=>{
  const value=block.trim();if(!value)return null;
  const image=/^!\[([^\]]*)\]\(([^\s]+)\)$/.exec(value);
  if(image){const src=publicImage(image[2]);if(!src)return null;return src.endsWith('.mp4')?<video key={i} controls playsInline preload="metadata" aria-label={image[1]} src={src}/>:<figure key={i}><img src={src} alt={image[1]||t('Kulübümüzden bir kare')} loading="lazy"/>{image[1]&&<figcaption>{image[1]}</figcaption>}</figure>;}
  if(value.startsWith('### '))return <h3 key={i}>{inline(value.slice(4),locale)}</h3>;
  if(value.startsWith('## ')||value.startsWith('# '))return <h2 key={i}>{inline(value.replace(/^#{1,2} /,''),locale)}</h2>;
  const lines=value.split('\n');if(lines.every(l=>l.startsWith('- ')))return <ul key={i}>{lines.map((l,j)=><li key={j}>{inline(l.slice(2),locale)}</li>)}</ul>;
  return <p key={i}>{lines.map((l,j)=><Fragment key={j}>{j>0&&<br/>}{inline(l,locale)}</Fragment>)}</p>;
 })}</div>;
}
