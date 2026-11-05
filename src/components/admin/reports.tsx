'use client';
import { useState } from 'react';
import { api, csvCell, dateLabel, istanbulDate, label, type Coach } from '@/lib/club-client';
import { Badge } from './data-table';
type Report = {session_id:string;starts_at:string;ends_at:string;status:string;expected:number;recorded:number;present:number;absent:number;excused:number;coaches:{coach_id:string;participation_status:string}[]};
export default function Reports({coaches,onExpired}:{coaches:Coach[];onExpired:()=>void}) {
 const today=istanbulDate(); const [from,setFrom]=useState(today.slice(0,8)+'01');const [until,setUntil]=useState(today);
 const [rows,setRows]=useState<Report[]|null>(null); const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 async function load(e:React.FormEvent<HTMLFormElement>) {
  e.preventDefault();setBusy(true);setError('');setRows(null);
  try {
   const end=new Date(`${until}T00:00:00+03:00`);end.setTime(end.getTime()+86400000);
   const query=new URLSearchParams({from:new Date(`${from}T00:00:00+03:00`).toISOString(),until:end.toISOString()});
   const result=await api<{data:Report[]}>(`/api/club/reports?${query}`);setRows(result.data);
  }catch(e){ if(e instanceof Error&&'status' in e&&e.status===401)onExpired();setError(e instanceof Error?e.message:'Rapor alınamadı.'); }finally{setBusy(false);}
 }
 function download() {
  if(!rows)return;
  const lines=[['Ders','Başlangıç','Durum','Sporcu','Girilen','Eksik','Var','Yok','Mazeretli','Antrenör katılımı'],...rows.map(r=>[r.session_id,dateLabel(r.starts_at,true),label(r.status),r.expected,r.recorded,Number(r.expected)-Number(r.recorded),r.present,r.absent,r.excused,r.coaches.map(c=>`${coaches.find(x=>x.id===c.coach_id)?.display_name??c.coach_id}: ${label(c.participation_status)}`).join('; ')])];
  const url=URL.createObjectURL(new Blob(['\ufeff'+lines.map(row=>row.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'}));
  const a=document.createElement('a');a.href=url;a.download=`deniz-aslanlari-rapor-${from}-${until}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 const completed=rows?.filter(r=>r.status==='COMPLETED')??[];
 return <section className="panel"><div className="panel-heading"><div><h2>Yoklama ve katılım raporu</h2><p>Türkiye saatine göre, en fazla 93 günlük tarih aralığı.</p></div>{rows&&<button className="button secondary" onClick={download} disabled={!rows.length}>CSV indir</button>}</div>
 <form className="filter-form" onSubmit={load}><label className="field"><span>Başlangıç</span><input type="date" value={from} onChange={e=>{setFrom(e.target.value);setRows(null);}} required/></label><label className="field"><span>Bitiş (dahil)</span><input type="date" value={until} min={from} onChange={e=>{setUntil(e.target.value);setRows(null);}} required/></label><button className="button" disabled={busy}>{busy?'Hazırlanıyor…':'Raporu getir'}</button></form>
 {error&&<p role="alert" className="notice error">{error}</p>}
 {rows&&<><div className="report-summary"><span><strong>{rows.length}</strong> ders</span><span><strong>{completed.length}</strong> tamamlandı</span><span><strong>{completed.reduce((s,r)=>s+Number(r.expected)-Number(r.recorded),0)}</strong> tamamlanan derslerde eksik yoklama</span></div><p className="muted">“Doğrulanmadı”, antrenörün derse gelmediği anlamına gelmez. Girilmeyen sporcu yoklaması da “Yok” sayılmaz.</p>
 {rows.length?<div className="table-scroll" tabIndex={0} aria-label="Katılım raporu"><table><thead><tr>{['Ders zamanı','Durum','Sporcu','Girilen / Eksik','Var / Yok / Mazeretli','Antrenör katılımı'].map(x=><th key={x} scope="col">{x}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.session_id}><td>{dateLabel(r.starts_at,true)}</td><td><Badge value={r.status} text={label(r.status)}/></td><td>{r.expected}</td><td>{r.recorded} / {Number(r.expected)-Number(r.recorded)}</td><td>{r.present} / {r.absent} / {r.excused}</td><td>{r.coaches.length?r.coaches.map(c=><div className="coach-report" key={c.coach_id}>{coaches.find(x=>x.id===c.coach_id)?.display_name??'Antrenör'} <Badge value={c.participation_status} text={label(c.participation_status)}/></div>):'Antrenör atanmadı'}</td></tr>)}</tbody></table></div>:<div className="empty"><p>Bu tarih aralığında ders bulunamadı.</p></div>}</>}
 {!rows&&!busy&&!error&&<div className="empty"><p>Bir tarih aralığı seçerek raporu oluşturun.</p></div>}
 </section>;
}
