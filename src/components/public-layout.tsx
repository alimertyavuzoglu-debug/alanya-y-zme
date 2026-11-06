import type {ReactNode} from 'react';
import type {SiteContent} from '@/lib/site-content';
import {PORTAL_LOGIN_URL} from '@/lib/site-addresses';
import {navContent} from '@/lib/public-navigation';
import PublicHeader from './public-header';
import PublicMotion from './public-motion';
export function PublicFooter({content:c}:{content:SiteContent}){
 return <footer className="public-full-footer"><div><strong>{c.brand}</strong><p>{c.footerText}</p><a href={`tel:${c.phone}`}>{c.phone}</a></div><nav aria-label="Kulüp bağlantıları"><a href="/hakkimizda">Kulübümüz</a><a href="/programlar">Eğitimler</a><a href="/kadro">Antrenörler</a><a href="/iletisim">İletişim</a></nav><nav aria-label="Bilgi ve başvuru"><a href="/basarilarimiz">Başarılarımız</a><a href="/blog">Yüzme rehberi</a><a href="/veli-bilgilendirme">Veli bilgilendirme</a><a href="/basvuru">Deneme dersine başvur</a></nav><nav aria-label="Diğer bağlantılar"><a href="/kvkk-aydinlatma-metni">KVKK aydınlatma</a><a href="/gizlilik">Gizlilik</a><a href="/en">English</a><a href={PORTAL_LOGIN_URL}>{c.navLogin}</a></nav></footer>;
}
export function PublicCallToAction({content:c}:{content:SiteContent}){return <section className="public-action-band" data-reveal><div><span className="site-overline">BİRLİKTE BAŞLAYALIM</span><h2>{c.contactTitle}</h2><p>{c.contactDescription}</p></div><div className="public-action-links"><a className="site-cta" href="/basvuru">{c.primaryCta}</a><a className="public-outline-link" href="/iletisim">İletişim bilgileri</a></div></section>;}
export default function PublicLayout({content,children,english=false,showAction=true}:{content:SiteContent;children:ReactNode;english?:boolean;showAction?:boolean}){return <PublicMotion><a href="#public-main" className="skip-link">İçeriğe geç</a><PublicHeader content={navContent(content)} solid english={english}/>{children}{showAction&&<PublicCallToAction content={content}/>}<PublicFooter content={content}/></PublicMotion>;}
