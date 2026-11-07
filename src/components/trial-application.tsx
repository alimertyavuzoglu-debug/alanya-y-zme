'use client';
import {translator} from '@/lib/public-i18n';
import type {PublicLocale} from '@/lib/public-locale';
import {useRef,useState} from 'react';
import {lessonLabels,trialApplicationSchema,trialEmailFields} from '@/lib/trial-application';

class SubmissionError extends Error {}

export default function TrialApplicationForm({phone,compact=false,locale='tr'}:{phone:string;compact?:boolean;locale?:PublicLocale}){
 const t=translator(locale);
 const formRef=useRef<HTMLFormElement>(null);
 const [forChild,setForChild]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[sent,setSent]=useState(false);
 const accessKey=process.env.NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY;
 async function submit(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;setError('');
  const fields=new FormData(e.currentTarget);
  if(fields.get('botcheck')){setError(t("Başvuru gönderilemedi. Lütfen yeniden deneyin."));return;}
  const parsed=trialApplicationSchema.safeParse({name:fields.get('name'),phone:fields.get('phone'),register_for:forChild?'CHILD':'SELF',child_age:forChild?Number(fields.get('child_age')):null,lesson_type:fields.get('lesson_type'),message:fields.get('message')??'',consent:fields.get('consent')==='on'});
  if(!parsed.success){setError(t("Ad, telefon, ders tercihi ve onay alanlarını kontrol edin."));return;}
  if(!accessKey){setError(t("Başvuru gönderimi şu anda kullanılamıyor. Aşağıdaki telefon üzerinden kulüple iletişime geçebilirsiniz."));return;}
  setBusy(true);
  try{
   const response=await fetch('https://api.web3forms.com/submit',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({access_key:accessKey,subject:t("Deneme dersi başvurusu — Deniz Aslanları"),from_name:t("Deniz Aslanları Web Sitesi"),...trialEmailFields(parsed.data),botcheck:'',preferred_language:locale}),signal:AbortSignal.timeout(20000)});
   const result=await response.json().catch(()=>null);
   if(!response.ok||result?.success!==true)throw new SubmissionError(response.status===429?t("Çok fazla deneme yapıldı. Biraz sonra yeniden deneyin."):t("Başvuru gönderilemedi. Bilgileriniz korunuyor; yeniden deneyebilir veya kulübü arayabilirsiniz."));
   formRef.current?.reset();setSent(true);
  }catch(e){setError(e instanceof Error&&e.name==='TimeoutError'?t("Gönderim zaman aşımına uğradı. Bilgileriniz korunuyor; yeniden deneyin."):e instanceof SubmissionError?e.message:t("Bağlantı kurulamadı. Bilgileriniz korunuyor; yeniden deneyebilir veya kulübü arayabilirsiniz."));}
  finally{setBusy(false);}
 }
 return <section id="basvuru" className={`trial-application ${compact?'trial-standalone':''}`} aria-labelledby={compact?undefined:"trial-title"} aria-label={compact?t("Deneme dersi başvurusu"):undefined} tabIndex={-1}>
  {!compact&&<div className="trial-intro"><span className="site-overline">{t("İLK ADIM")}</span><h2 id="trial-title">{t("Deneme dersi başvurusu")}</h2><p>{t("Kısa formu doldurun. Ders ve saat seçeneklerini görüşmek için sizinle iletişime geçelim.")}</p><a href={`tel:${phone}`} className="site-text-link">{t("Telefonla görüşün:")}{' '}{phone}</a></div>}
  <div className="trial-form-card">{sent?<div role="status" className="trial-success"><h3>{t("Başvurunuz gönderildi.")}</h3><p>{t("Ders ve saat seçenekleri için kulüp sizinle telefonla iletişime geçecektir.")}</p><button className="button secondary" type="button" onClick={()=>{setSent(false);setForChild(false);}}>{t("Yeni başvuru oluştur")}</button></div>:<form lang={locale} ref={formRef} onSubmit={submit} method="post" action="https://api.web3forms.com/submit" aria-label={t("Deneme dersi başvuru formu")}>
   <input type="hidden" name="preferred_language" value={locale}/><input type="hidden" name="access_key" value={accessKey??''}/><input type="hidden" name="subject" value="Deneme dersi başvurusu — Deniz Aslanları"/><input type="hidden" name="from_name" value="Deniz Aslanları Web Sitesi"/>
   <fieldset disabled={busy} className="form-grid">
    <label className="field"><span>{t("Ad soyad")}</span><input name="name" autoComplete="name" required minLength={2} maxLength={150}/></label>
    <label className="field"><span>{t("Telefon numarası")}</span><input name="phone" type="tel" autoComplete="tel" required minLength={10} maxLength={30} placeholder={t("05xx xxx xx xx")}/></label>
    <label className="field"><span>{t("Başvuru kimin için?")}</span><select name="register_for" value={forChild?'CHILD':'SELF'} onChange={e=>setForChild(e.target.value==='CHILD')}><option value="SELF">{t("Kendim için")}</option><option value="CHILD">{t("Çocuğum için")}</option></select></label>
    {forChild&&<label className="field"><span>{t("Çocuğun yaşı")}</span><input name="child_age" type="number" required min={1} max={25}/></label>}
    <label className="field"><span>{t("Ders tercihi")}</span><select name="lesson_type" required defaultValue=""><option value="" disabled>{t("Seçiniz")}</option>{Object.entries(lessonLabels).map(([value,label])=><option key={value} value={value}>{t(label)}</option>)}</select></label>
    <label className="field full"><span>{t("Notunuz (isteğe bağlı)")}</span><textarea name="message" rows={4} maxLength={1000} placeholder={t("Tercih ettiğiniz günleri veya yüzme seviyenizi yazabilirsiniz.")}/></label>
    <div className="trial-data-note full"><p>{t("Ad, telefon ve ders tercihiniz, deneme dersi talebiniz hakkında sizinle iletişime geçilmesi amacıyla Web3Forms e-posta hizmeti üzerinden kulübe iletilir.")}</p><label className="trial-consent"><input name="consent" type="checkbox" required/><span>{t("Bilgilerimin bu başvuru amacıyla iletilmesini ve benimle iletişime geçilmesini kabul ediyorum.")}</span></label></div>
    <input type="text" name="botcheck" tabIndex={-1} autoComplete="off" className="trial-honeypot" aria-hidden="true"/>
   </fieldset>
   {error&&<p role="alert" className="notice error">{error}</p>}
   <button className="site-cta trial-submit" type="submit" disabled={busy}>{busy?t("Gönderiliyor…"):t("Başvuruyu gönder")}</button>
  </form>}</div>
 </section>;
}
