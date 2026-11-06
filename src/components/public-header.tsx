'use client';
import {useState} from 'react';
import {usePathname} from 'next/navigation';
import {PORTAL_LOGIN_URL,PUBLIC_SITE_ORIGIN} from '@/lib/site-addresses';
import type {NavContent} from '@/lib/public-navigation';
export default function PublicHeader({content:c,solid=false,english=false}:{content:NavContent;solid?:boolean;english?:boolean}){
 const [open,setOpen]=useState(false);const path=usePathname();const preview=path==='/onizleme';
 const links=english?[['/en/about','Our club'],['/en/programmes','Programmes'],['/en/coaches','Coaches'],['/en/contact','Contact']]:[['/hakkimizda',c.navAbout],['/programlar',c.navPrograms],['/kadro',c.navCoaches],['/iletisim',c.navContact]];
 return <header className={`site-header ${solid?'public-header-solid':''}`}><a className="site-brand" href={preview?PUBLIC_SITE_ORIGIN:'/'} aria-label={english?'Home':'Ana sayfa'}><img className="site-monogram" src="/images/monogram.png" alt="" width={125} height={60}/><span><strong>{c.brand}</strong><small>{c.brandSubtitle}</small></span></a><button className="menu-toggle" aria-expanded={open} aria-controls="site-navigation" onClick={()=>setOpen(!open)}>{open?(english?'Close menu':'Menüyü kapat'):(english?'Menu':'Menü')}</button><nav id="site-navigation" className={open?'site-nav open':'site-nav'} aria-label={english?'Main navigation':'Ana menü'}>{links.map(([href,label])=><a key={href} href={preview?PUBLIC_SITE_ORIGIN+href:href} aria-current={path===href||path.startsWith(href+'/')?'page':undefined} onClick={()=>setOpen(false)}>{label}</a>)}<a className="portal-link" href={PORTAL_LOGIN_URL}>{english?'Club login':c.navLogin}</a></nav></header>;
}
