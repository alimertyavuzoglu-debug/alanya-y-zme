'use client';
import {useState} from 'react';
import {usePathname} from 'next/navigation';
import {PORTAL_LOGIN_URL,PUBLIC_SITE_ORIGIN} from '@/lib/site-addresses';
import {localizedPath,locales,localeNames,type PublicLocale} from '@/lib/public-locale';
import {translator} from '@/lib/public-i18n';
import type {NavContent} from '@/lib/public-navigation';
export default function PublicHeader({content:c,solid=false,locale='tr'}:{content:NavContent;solid?:boolean;locale?:PublicLocale}){
 const [open,setOpen]=useState(false);const current=usePathname();const preview=current==='/onizleme';const t=translator(locale);
 const path=(value:string)=>(preview?PUBLIC_SITE_ORIGIN:'')+localizedPath(value,locale);
 const links=[['/hakkimizda',c.navAbout],['/programlar',c.navPrograms],['/kadro',c.navCoaches],['/iletisim',c.navContact]];
 return <header className={`site-header ${solid?'public-header-solid':''}`}><a className="site-brand" href={path('/')} aria-label={t('Ana sayfa')}><span className="das-mark"><img className="club-emblem" src="/legacy/images/marka/favicon-512.png" alt={t('Alanya Deniz Aslanları kulüp logosu')} width={56} height={56}/><b>DAS<span aria-hidden="true">/</span></b></span><span><strong>{c.brand}</strong><small>{c.brandSubtitle}</small></span></a><div className="public-header-actions"><details className="public-language-picker"><summary aria-label={t('Dil seçimi')}><span aria-hidden="true">◎</span> {locale.toUpperCase()} <span aria-hidden="true">⌄</span></summary><nav aria-label={t('Dil seçenekleri')}>{locales.map(language=><a key={language} href={(preview?PUBLIC_SITE_ORIGIN:'')+localizedPath(preview?'/':current,language)} hrefLang={language} lang={language} aria-current={locale===language?'true':undefined}>{localeNames[language]}<span aria-hidden="true">{locale===language?'✓':''}</span></a>)}</nav></details><button className="menu-toggle" aria-expanded={open} aria-controls="site-navigation" onClick={()=>setOpen(!open)}>{open?t('Menüyü kapat'):t('Menü')}</button></div><nav id="site-navigation" className={open?'site-nav open':'site-nav'} aria-label={t('Ana menü')}>{links.map(([href,label])=><a key={href} href={path(href)} aria-current={current===localizedPath(href,locale)||current.startsWith(localizedPath(href,locale)+'/')?'page':undefined} onClick={()=>setOpen(false)}>{label}</a>)}<a className="portal-link" href={PORTAL_LOGIN_URL}>{c.navLogin}</a></nav></header>;
}
