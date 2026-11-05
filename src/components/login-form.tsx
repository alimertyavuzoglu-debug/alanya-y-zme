'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/club-client';
export default function LoginForm() {
 const router=useRouter(); const [busy,setBusy]=useState(false); const [error,setError]=useState('');
 async function submit(event:React.FormEvent<HTMLFormElement>) {
  event.preventDefault(); const form=new FormData(event.currentTarget); setBusy(true);setError('');
  try {
   await api('/api/auth/login',{method:'POST',body:JSON.stringify({email:form.get('email'),password:form.get('password')})});
   const me=await api<{roles:string[]}>('/api/auth/me');
   const destination=me.roles.includes('ADMIN')?'/admin':me.roles.includes('COACH')?'/coach':null;
   if(!destination){setError('Bu hesap için kulüp rolü tanımlanmamış. Yöneticiyle görüşün.');return;}
   router.replace(destination);router.refresh();
  }catch(e){setError(e instanceof Error?e.message:'Giriş yapılamadı.');}finally{setBusy(false);}
 }
 return <form onSubmit={submit} className="login-form"><fieldset disabled={busy}><label className="field"><span>E-posta adresi</span><input type="email" name="email" autoComplete="username" required maxLength={254} placeholder="adiniz@ornek.com"/></label><label className="field"><span>Parola</span><input type="password" name="password" autoComplete="current-password" required maxLength={256}/></label></fieldset>{error&&<p role="alert" className="notice error">{error}</p>}<button className="button" disabled={busy}>{busy?'Giriş yapılıyor…':'Panele giriş yap'}</button><p className="fine-print">Yalnızca kulüp tarafından yetkilendirilmiş hesaplar giriş yapabilir.</p></form>;
}
