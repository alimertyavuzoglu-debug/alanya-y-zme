'use client';
import {useState} from 'react';
import {PORTAL_LOGIN_URL} from '@/lib/site-addresses';
import type {SiteContent} from '@/lib/site-content';
export default function PublicSite({content:c}:{content:SiteContent}){
 const [open,setOpen]=useState(false);const [active,setActive]=useState('#kulup');
 const links=[['#kulup',c.navAbout],['#egitimler',c.navPrograms],['#antrenorler',c.navCoaches],['#iletisim',c.navContact]];
 return <div className="public-site"><a href="#public-main" className="skip-link">İçeriğe geç</a><section className="site-hero" aria-labelledby="hero-title"><img className="hero-photo" src={c.heroImage} alt={c.heroAlt} fetchPriority="high"/><div className="hero-shade"/>
 <header className="site-header"><a className="site-brand" href="/" aria-label="Ana sayfa"><img className="site-monogram" src="/images/monogram.png" alt="" width={125} height={60}/><span><strong>{c.brand}</strong><small>{c.brandSubtitle}</small></span></a><button className="menu-toggle" aria-expanded={open} aria-controls="site-navigation" onClick={()=>setOpen(!open)}>{open?'Menüyü kapat':'Menü'}</button><nav id="site-navigation" className={open?'site-nav open':'site-nav'} aria-label="Ana menü">{links.map(([href,text])=><a key={href} href={href} aria-current={active===href?'location':undefined} onClick={()=>{setOpen(false);setActive(href);}}>{text}</a>)}<a className="portal-link" href={PORTAL_LOGIN_URL}>{c.navLogin}</a></nav></header>
 <main id="public-main" className="hero-copy"><div className="hero-eyebrow">{c.eyebrow}</div><h1 id="hero-title">{c.heroTitle}</h1><p>{c.heroDescription}</p><div className="hero-actions"><a className="site-cta" href="#iletisim">{c.primaryCta}</a><a className="hero-secondary" href="#kulup">{c.secondaryCta}</a></div></main></section>
 <section className="site-programs" id="egitimler" aria-labelledby="program-title"><h2 id="program-title">{c.introTitle}</h2><div className="program-grid"><article><h3>{c.swimTitle}</h3><p>{c.swimDescription}</p><a href="#iletisim" aria-label={`${c.swimTitle} hakkında iletişime geçin`}><img src={c.swimImage} alt={c.swimAlt} loading="lazy" width={1200} height={650}/></a></article><article><h3>{c.triTitle}</h3><p>{c.triDescription}</p><a href="#iletisim" aria-label={`${c.triTitle} hakkında iletişime geçin`}><img src={c.triImage} alt={c.triAlt} loading="lazy" width={1200} height={650}/></a></article></div></section>
 <section id="kulup" className="site-about"><span className="site-overline">{c.navAbout}</span><div><h2>{c.aboutTitle}</h2><p>{c.aboutDescription}</p></div></section>
 <section id="antrenorler" className="site-about coaches-section"><span className="site-overline">{c.navCoaches}</span><div><h2>{c.coachesTitle}</h2><p>{c.coachesDescription}</p><a href="#iletisim" className="site-text-link">{c.navContact}</a></div></section>
 <section id="iletisim" className="site-contact"><div><h2>{c.contactTitle}</h2><p>{c.contactDescription}</p></div><a className="site-cta" href={`tel:${c.phone}`}>{c.phone}</a></section>
 <footer className="site-footer"><strong>{c.brand}</strong><span>{c.footerText}</span><a href={PORTAL_LOGIN_URL}>{c.navLogin}</a></footer></div>;
}
