import PortalBrand from '@/components/portal-brand';
import type {Metadata} from 'next';
export const metadata:Metadata={title:'Kulüp girişi | Deniz Aslanları',robots:{index:false,follow:false}};
import LoginForm from '@/components/login-form';
export default function Login() {
 return <main className="login-page"><section className="login-story"><PortalBrand href="https://alanyadenizaslanlarisk.com/" subtitle="YÜZME & TRİATLON SPOR KULÜBÜ"/><div><span className="eyebrow">ALANYA · KULÜP YÖNETİMİ</span><h1>Suyun içinde güç.<br/>Birlikte daha ileri.</h1><p>Sporcular, antrenmanlar ve kulübün günlük akışı.<br/>Hepsi aynı yerde.</p></div><small>Deniz Aslanları Spor Kulübü</small></section><section className="login-card"><span className="eyebrow">KULÜP PORTALI</span><h2>Tekrar hoş geldiniz.</h2><p className="muted">Yönetici veya antrenör hesabınızla giriş yapın.</p><LoginForm/><a className="back-link" href="https://alanyadenizaslanlarisk.com/">← Kulüp sitesine dön</a></section></main>;
}
