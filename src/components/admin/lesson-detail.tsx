'use client';
import { useState } from 'react';
import { api, dateLabel, istanbulDate, label, rowName, type ClubData, type Coach, type RecordRow } from '@/lib/club-client';
import { Badge } from './data-table';
export default function LessonDetail({lesson,data,coaches,refresh,onBack}:{lesson:RecordRow;data:ClubData;coaches:Coach[];refresh:()=>Promise<void>;onBack:()=>void}) {
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [success,setSuccess]=useState('');
 const roster=data.session_athletes.filter(r=>r.session_id===lesson.id);
 const assigned=data.session_coaches.filter(r=>r.session_id===lesson.id);
 const day=istanbulDate(String(lesson.starts_at));
 const possibleCoaches=coaches.filter(c=>c.is_active&&!assigned.some(a=>a.coach_id===c.id)&&data.coach_assignments.some(a=>a.coach_id===c.id&&a.group_term_id===lesson.group_term_id&&String(a.starts_on)<=day&&String(a.ends_on)>=day));
 const possibleMembers=data.enrollments.filter(e=>e.group_term_id===lesson.group_term_id&&String(e.joined_on)<=day&&(!e.left_on||String(e.left_on)>=day)&&!roster.some(r=>r.athlete_id===e.athlete_id));
 const editable=lesson.status!=='CANCELLED';
 const canMark=editable&&new Date(String(lesson.starts_at)).getTime()<=Date.now();
 async function save(resource:string,body:Record<string,unknown>,params?:Record<string,string>) {
  setBusy(true);setError('');setSuccess('');
  let saved=false;
  try {await api(`/api/club/${resource}${params?'?'+new URLSearchParams(params):''}`,{method:params?'PATCH':'POST',body:JSON.stringify(body)});saved=true;await refresh();setSuccess('Değişiklik kaydedildi.');}
  catch(e){setError(saved?'Kayıt kaydedildi ancak liste yenilenemedi. Yenile düğmesini kullanın.':e instanceof Error?e.message:'İşlem tamamlanamadı.');}finally{setBusy(false);}
 }
 return <div><button className="text-button back-button" onClick={onBack}>← Ders listesine dön</button><section className="panel"><div className="panel-heading"><div><span className="eyebrow">DERS DETAYI</span><h2>{data.group_terms.find(t=>t.id===lesson.group_term_id)?.name??'Ders'}</h2><p>{dateLabel(lesson.starts_at,true)} — {dateLabel(lesson.ends_at,true)} · Türkiye saati</p></div><Badge value={lesson.status} text={label(lesson.status)}/></div>
 {error&&<p role="alert" className="notice error">{error}</p>}{success&&<p role="status" className="notice success">{success}</p>}
 {(!assigned.length||!roster.length)&&<p className="notice">Ders hazırlığı eksik: {!assigned.length?'antrenör atayın. ':''}{!roster.length?'Sporcu listesini oluşturun.':''}</p>}
 <h3>Antrenörler ve derse katılım</h3><p className="muted">Katılımı yönetici doğrular; sporcu yoklamasından otomatik hesaplanmaz.</p>
 {assigned.map(a=><div className="assignment-row" key={String(a.coach_id)}><strong>{coaches.find(c=>c.id===a.coach_id)?.display_name??'Antrenör'}</strong><Badge value={a.participation_status} text={label(a.participation_status)}/><label className="inline-field"><span>Katılım</span><select aria-label={`${coaches.find(c=>c.id===a.coach_id)?.display_name??'Antrenör'} katılımı`} value={String(a.participation_status)} disabled={busy||!editable} onChange={e=>void save('session_coaches',{participation_status:e.target.value},{session_id:String(lesson.id),coach_id:String(a.coach_id)})}>{['UNCONFIRMED','ATTENDED','ABSENT','EXCUSED'].map(x=><option key={x} value={x}>{label(x)}</option>)}</select></label></div>)}
 {editable&&<form className="inline-form" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);void save('session_coaches',{session_id:lesson.id,coach_id:f.get('coach_id')});}}><label className="field"><span>Antrenör ekle</span><select key={assigned.length} name="coach_id" required defaultValue="" disabled={busy||!possibleCoaches.length}><option value="">Dönemde görevli antrenör seçin</option>{possibleCoaches.map(c=><option key={c.id} value={c.id}>{c.display_name}</option>)}</select></label><button className="button secondary" disabled={busy||!possibleCoaches.length}>Antrenör ata</button></form>}
 {!possibleCoaches.length&&editable&&<p className="fine-print">Eklenebilecek antrenör yok. Antrenörler ekranında bu dönem ve ders tarihi için görevlendirme yapın.</p>}
 <div className="section-divider"/><h3>Sporcu listesi ve yoklama</h3>
 {!canMark&&<p className="notice">{editable?'Ders başlamadan yoklama girilemez.':'Bu ders iptal edilmiş. Yeni yoklama girilemez.'}</p>}
 {roster.length?<div className="table-scroll" tabIndex={0} aria-label="Ders yoklaması"><table><thead><tr><th scope="col">Sporcu</th><th scope="col">Durum</th><th scope="col">Yoklama düzenle</th></tr></thead><tbody>{roster.map(r=>{
  const attendance=data.athlete_attendance.find(a=>a.session_id===lesson.id&&a.athlete_id===r.athlete_id);
  const name=rowName(data.athletes.find(a=>a.id===r.athlete_id));
  return <tr key={String(r.athlete_id)}><td>{name}</td><td>{attendance?<Badge value={attendance.status} text={label(attendance.status)}/>:<Badge value="UNCONFIRMED" text="Girilmedi"/>}</td><td><AttendanceForm key={`${r.athlete_id}-${attendance?.recorded_at??'new'}`} name={name} current={attendance} disabled={busy||!canMark} onSave={(status,note)=>save('athlete_attendance',{...(attendance?{}:{session_id:lesson.id,athlete_id:r.athlete_id}),status,note},attendance?{session_id:String(lesson.id),athlete_id:String(r.athlete_id)}:undefined)}/></td></tr>;
 })}</tbody></table></div>:<div className="empty"><p>Bu derse henüz sporcu eklenmedi.</p></div>}
 {editable&&<form className="inline-form" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);const enrollment=data.enrollments.find(x=>x.id===f.get('enrollment_id'));if(enrollment)void save('session_athletes',{session_id:lesson.id,athlete_id:enrollment.athlete_id,enrollment_id:enrollment.id});}}><label className="field"><span>Derse sporcu ekle</span><select key={roster.length} name="enrollment_id" required defaultValue="" disabled={busy||!possibleMembers.length}><option value="">Döneme kayıtlı sporcu seçin</option>{possibleMembers.map(e=><option key={String(e.id)} value={String(e.id)}>{rowName(data.athletes.find(a=>a.id===e.athlete_id))}</option>)}</select></label><button className="button secondary" disabled={busy||!possibleMembers.length}>Listeye ekle</button></form>}
 {!possibleMembers.length&&editable&&<p className="fine-print">Eklenebilecek sporcu yok. Sporcular ekranında bu döneme kayıt oluşturun.</p>}
 </section></div>;
}
function AttendanceForm({name,current,disabled,onSave}:{name:string;current?:RecordRow;disabled:boolean;onSave:(status:string,note:string|null)=>Promise<void>}) {
 const [status,setStatus]=useState(String(current?.status??''));const [note,setNote]=useState(String(current?.note??''));
 return <form className="attendance-form" onSubmit={e=>{e.preventDefault();void onSave(status,note.trim()||null);}}><select aria-label={`${name} yoklama durumu`} value={status} onChange={e=>setStatus(e.target.value)} required disabled={disabled}><option value="">Durum seçin</option>{['PRESENT','ABSENT','EXCUSED'].map(s=><option key={s} value={s}>{label(s)}</option>)}</select><input aria-label={`${name} yoklama notu`} placeholder="Not (isteğe bağlı)" maxLength={500} value={note} onChange={e=>setNote(e.target.value)} disabled={disabled}/><button className="button small" disabled={disabled||!status}>Kaydet</button></form>;
}
