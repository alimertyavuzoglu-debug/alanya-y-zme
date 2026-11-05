'use client';
import { useEffect, useState } from 'react';
import { api, dateLabel, type Coach } from '@/lib/club-client';
import type { CoachInvitation } from '@/lib/invitations';
import { Badge, DataTable } from './data-table';
import { RecordForm, type FormDefinition } from './record-form';

type SharedInvite = { email: string; url: string };
export default function CoachManagement({ coaches, onChanged }: { coaches: Coach[]; onChanged: () => Promise<void> }) {
 const [rows,setRows]=useState<CoachInvitation[]>([]);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 const [creating,setCreating]=useState(false),[editing,setEditing]=useState<Coach|null>(null);
 const [shared,setShared]=useState<SharedInvite|null>(null);
 async function load() {
  setLoading(true);setError('');
  try {
   const all: CoachInvitation[]=[];
   for(let page=0;page<=10000;page++) {
    const result=await api<{data:CoachInvitation[]}>(`/api/admin/coach-invitations?page=${page}`);
    all.push(...result.data);if(result.data.length<50)break;
   }
   setRows(all);
  }catch(e){setError(e instanceof Error?e.message:'Davetler yüklenemedi.');}
  finally{setLoading(false);}
 }
 useEffect(()=>{void load();},[]);
 async function create(email: string, display_name: string) {
  const result=await api<{url:string}>('/api/admin/coach-invitations',{method:'POST',body:JSON.stringify({email,display_name})});
  setShared({email,url:result.url});setNotice('Davet hazır. Bağlantıyı antrenörle paylaşın.');await load();
 }
 async function replace(row: CoachInvitation) {
  if(!window.confirm(`${row.email} için önceki bağlantı geçersiz olacak. Yeni davet oluşturulsun mu?`))return;
  setBusy(true);setError('');try{await create(row.email,row.display_name);}catch(e){setError(e instanceof Error?e.message:'Davet oluşturulamadı.');}finally{setBusy(false);}
 }
 async function revoke(row: CoachInvitation) {
  setBusy(true);setError('');
  try{await api('/api/admin/coach-invitations',{method:'DELETE',body:JSON.stringify({id:row.id})});setShared(null);setNotice('Davet iptal edildi.');await load();}
  catch(e){setError(e instanceof Error?e.message:'Davet iptal edilemedi.');}finally{setBusy(false);}
 }
 const inviteForm: FormDefinition={resource:'coach_invitations',title:'Antrenör davet et',submitLabel:'Davet bağlantısı oluştur',hint:'Adını ve e-posta adresini girin. Antrenör paylaştığınız bağlantıdan kendi parolasını oluşturur.',fields:[{key:'display_name',label:'Ad soyad',max:150},{key:'email',label:'E-posta adresi',type:'email',max:254}]};
 const editForm: FormDefinition|undefined=editing?{resource:'coaches',title:'Antrenör hesabını düzenle',initial:{...editing},hint:'Pasif hesap kulüp paneline erişemez. Önceki ders ve yoklama kayıtları korunur.',fields:[{key:'display_name',label:'Ad soyad',max:150},{key:'is_active',label:'Hesap aktif',type:'checkbox'}]}:undefined;
 const pending=rows.filter(r=>r.status==='PENDING');
 return <>
  <section className="panel"><div className="panel-heading"><div><h2>Antrenörler <span className="count">{coaches.length}</span></h2><p>Yeni antrenör davet edin veya mevcut hesabı yönetin.</p></div><button className="button" onClick={()=>{setNotice('');setCreating(true);}}>+ Antrenör davet et</button></div>
   {notice&&<p role="status" className="notice success">{notice}</p>}
   {shared&&<div className="invite-share"><strong>{shared.email} için davet bağlantısı</strong><p>7 gün geçerlidir. Bağlantıyı kopyalayıp e-posta veya WhatsApp ile paylaşın. Sayfadan ayrılmadan kopyalayın; gerekirse aşağıdan yeni bağlantı oluşturabilirsiniz.</p><label className="field"><span>Davet bağlantısı</span><input readOnly value={shared.url} onFocus={e=>e.target.select()}/></label><button className="button secondary small" onClick={async()=>{try{await navigator.clipboard.writeText(shared.url);setNotice('Davet bağlantısı kopyalandı.');}catch{setError('Bağlantıyı kutudan seçip kopyalayabilirsiniz.');}}}>Bağlantıyı kopyala</button></div>}
   <DataTable rows={coaches.map(c=>({...c}))} columns={[{heading:'Antrenör',render:r=><strong>{r.display_name}</strong>},{heading:'Hesap',render:r=><Badge value={r.is_active?'ACTIVE':'CLOSED'} text={r.is_active?'Aktif':'Pasif'}/>}]} actions={r=><button className="text-button" onClick={()=>setEditing(coaches.find(c=>c.id===r.id)??null)}>Hesabı düzenle<span className="sr-only">: {r.display_name}</span></button>}/>
  </section>
  <section className="panel"><div className="panel-heading"><div><h2>Bekleyen davetler <span className="count">{pending.length}</span></h2><p>Antrenör daveti tamamladığında yukarıdaki hesap listesinde görünür.</p></div><button className="button secondary small" disabled={loading||busy} onClick={async()=>{await load();try{await onChanged();}catch{setError('Davetler yenilendi; hesap listesini yeniden yükleyin.');}}}>Davetleri ve hesapları yenile</button></div>
   {error&&<p role="alert" className="notice error">{error}</p>}
   {loading?<p role="status">Davetler yükleniyor…</p>:pending.length?<div className="request-list">{pending.map(r=><article className="request-row" key={r.id}><div><strong>{r.display_name}</strong><p>{r.email}</p><small>{new Date(r.expires_at).getTime()<=Date.now()?'Süresi doldu':'Son kullanım: '+dateLabel(r.expires_at,true)}</small></div><div className="row-actions"><button className="button secondary small" disabled={busy} onClick={()=>void replace(r)}>Yeni bağlantı</button><button className="text-button" disabled={busy} onClick={()=>void revoke(r)}>Daveti iptal et</button></div></article>)}</div>:<p className="muted">Bekleyen davet yok.</p>}
   <details className="simple-details"><summary>Davet geçmişi</summary>{rows.filter(r=>r.status!=='PENDING').map(r=><p key={r.id}>{r.display_name} · {r.email} · {r.status==='ACCEPTED'?'Hesap oluşturuldu':'İptal edildi'}</p>)}</details>
  </section>
  {creating&&<RecordForm definition={inviteForm} onClose={()=>setCreating(false)} onSave={async payload=>create(String(payload.email),String(payload.display_name))}/>}
  {editing&&editForm&&<RecordForm definition={editForm} onClose={()=>setEditing(null)} onSave={async payload=>{
   await api('/api/admin/coaches',{method:'PATCH',body:JSON.stringify({id:editing.id,...payload})});setNotice('Antrenör hesabı güncellendi.');
   try{await onChanged();}catch{setError('Hesap kaydedildi; listeyi yenileyin.');}
  }}/>}
 </>;
}
