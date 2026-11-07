'use client';
import {PUBLIC_SITE_ORIGIN} from '@/lib/site-addresses';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/club-client';
import type { InvitationInfo } from '@/lib/invitations';
type InviteContext={invitation:InvitationInfo;user:{email:string;confirmed:boolean}|null};
export default function AcceptInvitation({token}:{token:string}) {
 const router=useRouter();
 const [context,setContext]=useState<InviteContext|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [mode,setMode]=useState<'signup'|'signin'>('signup'),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const load=useCallback(async()=>{
  setLoading(true);setError('');
  try{setContext(await api<InviteContext>(`/api/invitations?token=${token}`));}
  catch(e){setError(e instanceof Error?e.message:'Davet açılamadı.');}finally{setLoading(false);}
 },[token]);
 useEffect(()=>{void load();if(new URLSearchParams(window.location.search).has('auth_error'))setNotice('E-posta doğrulama oturumu açılamadı. Daveti başlattığınız tarayıcıyı kullanın veya doğrulama sonrasında mevcut parolanızla aşağıdan giriş yapın.');},[load]);
 function openPanel(destination?:string){router.replace(destination==='/admin'?'/admin':'/coach');router.refresh();}
 async function accept() {
  setBusy(true);setError('');try{const result=await api<{destination?:string}>('/api/invitations/accept',{method:'POST',body:JSON.stringify({token})});openPanel(result.destination);}
  catch(e){setError(e instanceof Error?e.message:'Davet tamamlanamadı.');}finally{setBusy(false);}
 }
 async function submit(e:React.FormEvent<HTMLFormElement>) {
  e.preventDefault();const form=new FormData(e.currentTarget);setError('');setNotice('');
  const password=String(form.get('password'));
  if(mode==='signup'&&password!==form.get('confirm')){setError('Parolalar eşleşmiyor.');return;}
  setBusy(true);
  try{
   const result=await api<{needs_confirmation?:boolean;destination?:string}>('/api/invitations/session',{method:'POST',body:JSON.stringify({token,action:mode,password})});
   if(result.needs_confirmation){setMode('signin');setNotice('E-postanıza gelen doğrulama bağlantısını bu tarayıcıda açın. Sonrasında daveti tamamlayın. Hesabınız zaten varsa mevcut parolanızla giriş yapın.');await load();}
   else openPanel(result.destination);
  }catch(e){setError(e instanceof Error?e.message:'İşlem tamamlanamadı.');}finally{setBusy(false);}
 }
 const ownSession=context?.user?.email.toLowerCase()===context?.invitation.email.toLowerCase();
 return <main className="invitation-page"><section className="panel invitation-card"><a href={PUBLIC_SITE_ORIGIN} className="eyebrow">DENİZ ASLANLARI SPOR KULÜBÜ</a><h1>{context?.invitation.invite_role==='ADMIN'?'Yönetici daveti':'Antrenör daveti'}</h1>
  {loading?<p role="status">Davet kontrol ediliyor…</p>:context?<><p>Merhaba <strong>{context.invitation.display_name}</strong>, kulübe <strong>{context.invitation.invite_role==='ADMIN'?'yönetici':'antrenör'}</strong> olarak davetlisiniz.</p><p className="invite-email">{context.invitation.email}</p>
   {notice&&<p role="status" className="notice">{notice}</p>}{error&&<p role="alert" className="notice error">{error}</p>}
   {ownSession?<><p>E-posta doğrulamasından sonra daveti tamamlayarak panelinize erişebilirsiniz.</p><button className="button" disabled={busy} onClick={()=>void accept()}>{busy?'Tamamlanıyor…':'Daveti kabul et ve panele geç'}</button>{!context.user?.confirmed&&<p className="fine-print">Önce e-postanızdaki doğrulama bağlantısını açın.</p>}</>:<>
    {context.user&&<p className="notice">Şu anda {context.user.email} hesabı açık. Aşağıdan davetin gönderildiği hesapla giriş yapın.</p>}
    <div className="section-switch" role="group" aria-label="Hesap seçimi"><button type="button" aria-pressed={mode==='signup'} disabled={busy} onClick={()=>{setMode('signup');setError('');}}>Yeni hesap oluştur</button><button type="button" aria-pressed={mode==='signin'} disabled={busy} onClick={()=>{setMode('signin');setError('');}}>Zaten hesabım var</button></div>
    <form className="login-form" onSubmit={submit}><fieldset disabled={busy}><label className="field"><span>{mode==='signup'?'Yeni parola':'Mevcut parola'}</span><input key={mode} type="password" name="password" autoComplete={mode==='signup'?'new-password':'current-password'} required minLength={mode==='signup'?12:1} maxLength={256}/>{mode==='signup'&&<small>En az 12 karakter kullanın.</small>}</label>{mode==='signup'&&<label className="field"><span>Parolayı tekrar girin</span><input type="password" name="confirm" autoComplete="new-password" required minLength={12} maxLength={256}/></label>}</fieldset><button className="button" disabled={busy}>{busy?'İşleniyor…':mode==='signup'?'Hesabımı oluştur':'Giriş yap ve daveti kabul et'}</button></form>
   </>}
  </>:<><p role="alert" className="notice error">{error}</p><p>Yeni davet bağlantısı için kulüp yöneticinizle görüşün.</p></>}
  <p className="fine-print invitation-footer">{context?.invitation.invite_role==='ADMIN'?'Yönetici yetkisiyle kulüp hesaplarını ve kayıtlarını yönetebilirsiniz.':'Dersleriniz yönetici ataması yapıldığında panelinizde görünür.'}</p><a href="/login" className="back-link">Giriş ekranına dön</a>
 </section></main>;
}
