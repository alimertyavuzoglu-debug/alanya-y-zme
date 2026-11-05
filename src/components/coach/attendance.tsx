'use client';
import {useEffect,useState} from 'react';
import {ApiError,api,dateLabel,label,rowName,type ClubData,type RecordRow} from '@/lib/club-client';
type Choice={status:string;note:string};
export default function CoachAttendance({lesson,data,refresh,onBack,onExpired,onDirtyChange}:{lesson:RecordRow;data:ClubData;refresh:()=>Promise<void>;onBack:()=>void;onExpired:()=>void;onDirtyChange:(dirty:boolean)=>void}){
 const [draft,setDraft]=useState<Record<string,Choice>>({}),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[page,setPage]=useState(0);
 const roster=data.session_athletes.filter(r=>r.session_id===lesson.id);
 const visible=roster.slice(page*50,page*50+50);
 const editable=lesson.status!=='CANCELLED'&&new Date(String(lesson.starts_at)).getTime()<=Date.now();
 function current(athlete:unknown):Choice{const row=data.athlete_attendance.find(a=>a.session_id===lesson.id&&a.athlete_id===athlete);return {status:String(row?.status??''),note:String(row?.note??'')};}
 function choose(id:string,patch:Partial<Choice>){setDraft(old=>({...old,[id]:{...(old[id]??current(id)),...patch}}));setNotice('');setError('');}
 const selected=Object.keys(draft).length;
 useEffect(()=>{onDirtyChange(selected>0);return()=>onDirtyChange(false);},[selected,onDirtyChange]);
 async function save(e:React.FormEvent){
  e.preventDefault();setBusy(true);setError('');setNotice('');let saved=false;
  try{
   await api('/api/coach/attendance',{method:'POST',body:JSON.stringify({session_id:lesson.id,entries:Object.entries(draft).map(([athlete_id,value])=>({athlete_id,status:value.status,note:value.note.trim()||null}))})});
   saved=true;setDraft({});await refresh();setNotice(`${selected} sporcunun yoklaması kaydedildi.`);
  }catch(e){if(e instanceof ApiError&&e.status===401)onExpired();setError(saved?'Yoklama kaydedildi ancak liste yenilenemedi. Yenile düğmesini kullanın.':e instanceof Error?e.message:'Yoklama kaydedilemedi.');}
  finally{setBusy(false);}
 }
 const canSave=editable&&selected>0&&selected<=100&&Object.values(draft).every(v=>['PRESENT','ABSENT','EXCUSED'].includes(v.status));
 return <div><button className="text-button back-button" onClick={()=>{if(!selected||window.confirm('Kaydedilmemiş yoklama seçimleri silinecek. Devam edilsin mi?'))onBack();}} disabled={busy}>← Derslerime dön</button><section className="panel"><div className="panel-heading"><div><span className="eyebrow">DERS YOKLAMASI</span><h2>{data.group_terms.find(t=>t.id===lesson.group_term_id)?.name??'Dersim'}</h2><p>{dateLabel(lesson.starts_at,true)} — {dateLabel(lesson.ends_at,true)}</p></div><span className="badge">{label(lesson.status)}</span></div>
 <p className="muted">Yalnızca sizin girdiğiniz yoklamalar gösterilir. Boş durum “Yok” anlamına gelmez. Ders listenizdeki başka bir kayıt için düzenleme yetkiniz yoksa yöneticiyle görüşün.</p>
 {!editable&&<p className="notice">{lesson.status==='CANCELLED'?'İptal edilmiş dersin yoklaması değiştirilemez.':'Ders başlamadan yoklama alınamaz.'}</p>}
 {error&&<p role="alert" className="notice error">{error}</p>}{notice&&<p role="status" className="notice success">{notice}</p>}
 <form onSubmit={save}><fieldset disabled={busy}><div className="coach-attendance-toolbar"><span>{roster.length} sporcu · {selected} seçim</span><button type="button" className="button secondary small" disabled={!editable||!visible.length||new Set([...Object.keys(draft),...visible.map(r=>String(r.athlete_id))]).size>100} onClick={()=>{setDraft(old=>{const next={...old};for(const row of visible){const id=String(row.athlete_id);next[id]={...(next[id]??current(id)),status:'PRESENT'};}return next;});setNotice('');}}>Bu sayfadakileri Var seç</button></div>
 {visible.length?<div className="coach-roster">{visible.map(r=>{const id=String(r.athlete_id),name=rowName(data.athletes.find(a=>a.id===id)),value=draft[id]??current(id);return <div className="coach-roster-row" key={id}><div><strong>{name}</strong><small>{draft[id]?'Kaydedilmemiş seçim':value.status?label(value.status):'Henüz girilmedi'}</small>{draft[id]&&<button type="button" className="text-button" onClick={()=>setDraft(old=>{const next={...old};delete next[id];return next;})}>Seçimi geri al<span className="sr-only">: {name}</span></button>}</div><div className="coach-status-options" role="group" aria-label={`${name} yoklaması`}>{['PRESENT','ABSENT','EXCUSED'].map(status=><button type="button" key={status} aria-pressed={value.status===status} className={`coach-status ${value.status===status?'chosen':''}`} disabled={!editable} onClick={()=>choose(id,{status})}>{label(status)}</button>)}</div><input type="text" className="coach-note" aria-label={`${name} yoklama notu`} value={value.note} maxLength={500} placeholder="Not (isteğe bağlı)" disabled={!editable} onChange={e=>choose(id,{note:e.target.value})}/></div>;})}</div>:<div className="empty"><p>Dersin sporcu listesi henüz hazırlanmadı. Yöneticiyle görüşün.</p></div>}
 {roster.length>50&&<div className="coach-pagination"><button type="button" className="button secondary small" disabled={page===0} onClick={()=>setPage(p=>p-1)}>Önceki</button><span>Sayfa {page+1} / {Math.ceil(roster.length/50)}</span><button type="button" className="button secondary small" disabled={(page+1)*50>=roster.length} onClick={()=>setPage(p=>p+1)}>Sonraki</button></div>}
 <div className="editor-actions coach-save-actions"><span>{selected>100?'Bir işlemde en fazla 100 sporcu seçilebilir.':selected?'Seçimler kaydedilene kadar yoklama değişmez.':'Kaydedilecek seçim yok.'}</span><div className="row-actions"><button type="button" className="button secondary" disabled={!selected} onClick={()=>{setDraft({});setError('');}}>Seçimleri temizle</button><button className="button" disabled={!canSave}>{busy?'Kaydediliyor…':'Seçilenleri kaydet'}</button></div></div></fieldset></form>
 </section></div>;
}
