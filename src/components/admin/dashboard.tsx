'use client';
import {PUBLIC_SITE_ORIGIN} from '@/lib/site-addresses';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, api, dateLabel, istanbulDate, label, loadTable, rowName, tables, type ClubData, type Coach, type RecordRow } from '@/lib/club-client';
import { DataTable, Badge, type Column } from './data-table';
import { RecordForm, type FormDefinition } from './record-form';
import { definitions } from './definitions';
import LessonDetail from './lesson-detail';
import Reports from './reports';
import SiteEditor from './site-editor';
import RequestReview from './request-review';
import NewLesson from './new-lesson';
import CoachManagement from './coach-management';
const navigation=[['overview','Genel bakış'],['groups','Gruplar ve dönemler'],['athletes','Sporcular'],['coaches','Antrenörler'],['sessions','Ders takvimi'],['plans','Antrenman programları'],['reports','Yoklama ve raporlar'],['content','Site içeriği']] as const;
type Tab=typeof navigation[number][0];
const descriptions:Record<Tab,string>={overview:'Kulübün günlük akışı, tek bir bakışta.',groups:'Grupları oluşturun, dönem tarihlerini yönetin.',athletes:'Sporcu bilgileri ve dönem kayıtları.',coaches:'Antrenörler ve grup görevlendirmeleri.',sessions:'Tüm antrenörlerin dersleri ve ders hazırlıkları.',plans:'Kulüp programları, grup planları ve haftalık ders saatleri.',reports:'Sporcu yoklaması ve antrenör katılımını izleyin.',content:'Web sitesinin metinlerini ve görsellerini yönetin.'};
export default function AdminDashboard() {
 const router=useRouter();const [createLesson,setCreateLesson]=useState(false);const [athleteView,setAthleteView]=useState<'list'|'requests'>('list'); const [tab,setTab]=useState<Tab>('overview');
 const [me,setMe]=useState<{id:string;display_name:string}|null>(null);const [denied,setDenied]=useState(false);
 const [data,setData]=useState<ClubData>({});const [coaches,setCoaches]=useState<Coach[]>([]);
 const [loading,setLoading]=useState(true);const [refreshing,setRefreshing]=useState(false);const [error,setError]=useState('');const [notice,setNotice]=useState('');
 const [form,setForm]=useState<FormDefinition|null>(null);const [lessonId,setLessonId]=useState<string|null>(null);const [search,setSearch]=useState('');
 const expired=useCallback(()=>router.replace('/login'),[router]);
 const refresh=useCallback(async()=>{
  setRefreshing(true);setError('');
  try {
   const [directory,...values]=await Promise.all([api<{data:Coach[]}>('/api/admin/coaches'),...tables.map(loadTable)]);
   setCoaches(directory.data);setData(Object.fromEntries(tables.map((t,i)=>[t,values[i]])));
  }catch(e){if(e instanceof ApiError&&e.status===401)expired();setError(e instanceof Error?e.message:'Kayıtlar yüklenemedi.');throw e;}
  finally{setRefreshing(false);}
 },[expired]);
 useEffect(()=>{
  let active=true;
  void (async()=>{
   try {
    const result=await api<{user:{id:string;display_name:string};roles:string[]}>('/api/auth/me');
    if(!active)return;
    if(!result.roles.includes('ADMIN')){setDenied(true);return;}
    setMe(result.user);await refresh();
   }catch(e){if(!active)return;if(e instanceof ApiError&&e.status===401)expired();else setError(e instanceof Error?e.message:'Oturum doğrulanamadı.');}
   finally{if(active)setLoading(false);}
  })();return()=>{active=false;};
 },[expired,refresh]);
 async function logout(){setRefreshing(true);try{await api('/api/auth/logout',{method:'POST',body:'{}'});router.replace('/login');router.refresh();}catch(e){setError(e instanceof Error?e.message:'Çıkış yapılamadı.');}finally{setRefreshing(false);}}
 const defs=definitions(data,coaches);
 function open(resource:string,row?:RecordRow) {
  if(resource==='sessions'&&!row){setCreateLesson(true);return;}
  const d=defs[resource];if(!d)return;
  const frozen=resource==='sessions'&&row&&(data.session_coaches.some(x=>x.session_id===row.id)||data.session_athletes.some(x=>x.session_id===row.id));
  setForm({...d,title:`${d.title} ${row?'düzenle':'ekle'}`,initial:row,keys:['id'],fields:d.fields.map(f=>frozen&&['starts_at','ends_at'].includes(f.key)?{...f,immutable:true}:f)});
 }
 async function saveForm(payload:Record<string,unknown>) {
  if(!form)return;
  if(form.resource==='schedule_rules'&&payload.weekday)payload.weekday=Number(payload.weekday);
  const query=form.initial?'?'+new URLSearchParams(Object.fromEntries((form.keys??['id']).map(k=>[k,String(form.initial?.[k])]))):'';
  try {await api(`/api/club/${form.resource}${query}`,{method:form.initial?'PATCH':'POST',body:JSON.stringify(payload)});}
  catch(e){if(e instanceof ApiError&&e.status===401)expired();throw e;}
  setNotice('Kayıt başarıyla kaydedildi.');
  try{await refresh();}catch{setError('Kayıt kaydedildi ancak liste yenilenemedi. Yenile düğmesini kullanın.');}
 }
 const termName=(id:unknown)=>String(data.group_terms?.find(t=>t.id===id)?.name??'—');
 const groupName=(id:unknown)=>rowName(data.groups?.find(g=>g.id===id));
 const coachName=(id:unknown)=>coaches.find(c=>c.id===id)?.display_name??'Antrenör';
 const athleteName=(id:unknown)=>rowName(data.athletes?.find(a=>a.id===id));
 const statusColumn:Column={heading:'Durum',render:r=><Badge value={r.status??(r.is_active?'ACTIVE':'CLOSED')} text={r.status?label(r.status):r.is_active?'Aktif':'Pasif'}/>};
 const dateColumn=(key:string,heading:string,time=false):Column=>({heading,render:r=>dateLabel(r[key],time)});
 function section(resource:string,title:string,subtitle:string,columns:Column[],rows?:RecordRow[]) {
  return <section className="panel" key={resource}><div className="panel-heading"><div><h2>{title} <span className="count">{(rows??data[resource]??[]).length}</span></h2><p>{subtitle}</p></div><button className="button small" onClick={()=>open(resource)}>+ {defs[resource].title} ekle</button></div><DataTable rows={rows??data[resource]??[]} columns={columns} actions={r=><button className="text-button" onClick={()=>open(resource,r)}>Düzenle<span className="sr-only">: {rowName(r)}</span></button>}/></section>;
 }
 function go(next:Tab){setTab(next);setSearch('');setLessonId(null);setNotice('');}
 const today=istanbulDate();
 const todayLessons=(data.sessions??[]).filter(s=>istanbulDate(String(s.starts_at))===today).sort((a,b)=>String(a.starts_at).localeCompare(String(b.starts_at)));
 const sessionColumns:Column[]=[{heading:'Grup / dönem',render:r=><strong>{termName(r.group_term_id)}</strong>},dateColumn('starts_at','Başlangıç',true),dateColumn('ends_at','Bitiş',true),{heading:'Antrenör',render:r=>{const names=(data.session_coaches??[]).filter(c=>c.session_id===r.id).map(c=>coachName(c.coach_id));return names.length?names.join(', '):<span className="warning-text">Atanmadı</span>;}},statusColumn];
 function sessionActions(r:RecordRow){return <><button className="text-button" onClick={()=>{setLessonId(String(r.id));setTab('sessions');}}>Ders detayı</button>{r.status!=='CANCELLED'&&<button className="text-button" onClick={()=>open('sessions',r)}>Düzenle</button>}</>;}
 const selectedLesson=data.sessions?.find(s=>s.id===lessonId);
 if(loading&&!me)return <main className="state-page" role="status"><span className="eyebrow">DENİZ ASLANLARI</span><h1>Oturumunuz doğrulanıyor…</h1></main>;
 if(denied)return <main className="state-page"><h1>Yönetici erişimi gerekli</h1><p>Bu panel yönetici hesaplarına özeldir. Antrenör hesabınızla kendi panelinizi açabilirsiniz.</p><a className="button" href="/coach">Antrenör paneline git</a> <button className="button secondary" onClick={()=>void logout()}>Çıkış yap</button>{error&&<p role="alert">{error}</p>}</main>;
 if(!me)return <main className="state-page"><h1>Panel açılamadı</h1><p role="alert">{error||'Lütfen hesabınızla giriş yapın.'}</p><a className="button" href="/login">Giriş ekranına dön</a></main>;
 return <div className="admin-shell"><a className="skip-link" href="#main-content">İçeriğe geç</a><aside className="sidebar"><a href="/admin" className="brand"><span className="brand-emblem" aria-hidden="true">DA</span><span>DENİZ ASLANLARI<small>KULÜP YÖNETİMİ</small></span></a><div className="sidebar-caption">ÇALIŞMA ALANI</div><nav aria-label="Yönetim menüsü">{(['overview','sessions','athletes','groups','coaches','content'] as Tab[]).map(id=><button key={id} className={tab===id?'nav-item active':'nav-item'} aria-current={tab===id?'page':undefined} onClick={()=>go(id)}>{navigation.find(([key])=>key===id)?.[1]}</button>)}<details className="nav-more" open={tab==='plans'||tab==='reports'?true:undefined}><summary>Programlar ve raporlar</summary>{(['plans','reports'] as Tab[]).map(id=><button key={id} className={tab===id?'nav-item active':'nav-item'} aria-current={tab===id?'page':undefined} onClick={()=>go(id)}>{navigation.find(([key])=>key===id)?.[1]}</button>)}</details></nav><div className="sidebar-bottom"><div className="club-stamp"><span className="status-dot"/> Alanya, Türkiye<small>Yüzme & Triatlon Spor Kulübü</small></div><a href={PUBLIC_SITE_ORIGIN}>Kulüp sitesini ziyaret et →</a></div></aside>
 <div className="workspace"><header className="topbar"><span className="workspace-label">Kulüp portalı <span>/ Yönetici</span></span><div className="account"><span className="avatar" aria-hidden="true">{me.display_name.slice(0,1).toLocaleUpperCase('tr-TR')}</span><div><strong>{me.display_name}</strong><small>Yönetici</small></div><button className="text-button" onClick={()=>void logout()} disabled={refreshing}>Çıkış yap</button></div></header>
 <main id="main-content" className="content"><div className="page-heading"><div><span className="eyebrow">DENİZ ASLANLARI SPOR KULÜBÜ</span><h1>{navigation.find(([id])=>id===tab)?.[1]}</h1><p>{descriptions[tab]}</p></div><div className="heading-tools"><span className="today-label">{dateLabel(today)}</span><button className="button secondary small" onClick={()=>void refresh().catch(()=>{})} disabled={refreshing}>{refreshing?'Yenileniyor…':'Yenile'}</button></div></div>
 {error&&<p role="alert" className="notice error">{error}</p>}{notice&&<p role="status" className="notice success">{notice}</p>}
 {loading?<section className="panel empty" role="status">Kulüp kayıtları yükleniyor…</section>:!Object.keys(data).length?<section className="panel empty"><h2>Kayıtlar yüklenemedi</h2><p>Bağlantıyı kontrol edip Yenile düğmesini kullanın.</p></section>:<>
 {tab==='overview'&&<><div className="admin-quick-actions"><button className="button" onClick={()=>open('sessions')}>+ Ders oluştur</button><button className="button secondary" onClick={()=>{go('athletes');setAthleteView('requests');}}>Sporcu taleplerini incele</button></div><div className="stats-grid">{[['Aktif sporcu',(data.athletes??[]).filter(a=>a.is_active).length,'athletes'],['Aktif dönem',(data.group_terms??[]).filter(t=>t.status==='ACTIVE').length,'groups'],['Antrenör',coaches.filter(c=>c.is_active).length,'coaches'],['Bugünkü ders',todayLessons.filter(s=>s.status!=='CANCELLED').length,'sessions']].map(([title,value,target])=><button className="stat-card" key={title} onClick={()=>go(target as Tab)}><span>{title}</span><strong>{value}</strong><small>Detayları görüntüle →</small></button>)}</div><section className="panel"><div className="panel-heading"><div><h2>Bugünün dersleri</h2><p>Türkiye saati · {dateLabel(today)}</p></div><button className="text-button" onClick={()=>go('sessions')}>Tüm dersler →</button></div><DataTable rows={todayLessons} columns={sessionColumns} actions={sessionActions} empty="Bugün için planlanmış ders bulunmuyor."/></section></>}
 {tab==='groups'&&<>{section('groups','Gruplar','Branş ve seviye bazında kulüp grupları.',[{heading:'Grup',render:r=><strong>{r.name}</strong>},{heading:'Branş',render:r=>label(r.sport)},{heading:'Seviye',render:r=>r.level||'—'},statusColumn])}{section('group_terms','Dönemler','Başlangıç ve bitiş tarihlerini manuel olarak belirleyin.',[{heading:'Dönem',render:r=><strong>{r.name}</strong>},{heading:'Grup',render:r=>groupName(r.group_id)},dateColumn('start_date','Başlangıç'),dateColumn('end_date','Bitiş'),statusColumn])}</>}
 {tab==='athletes'&&<><div className="section-switch" role="group" aria-label="Sporcu görünümü"><button aria-pressed={athleteView==='list'} onClick={()=>setAthleteView('list')}>Sporcular ve kayıtlar</button><button aria-pressed={athleteView==='requests'} onClick={()=>setAthleteView('requests')}>Sporcu onayları</button></div>{athleteView==='requests'?<RequestReview data={data} coaches={coaches} onChanged={refresh}/>:<><div className="search-row"><label className="field"><span>Sporcu ara</span><input type="search" placeholder="Ad veya soyad…" value={search} onChange={e=>setSearch(e.target.value)}/></label></div>{section('athletes','Sporcular','Sporcu bilgilerini düzenleyin; kayıtları silmek yerine pasifleştirin.',[{heading:'Ad soyad',render:r=><strong>{rowName(r)}</strong>},dateColumn('birth_date','Doğum tarihi'),statusColumn],data.athletes.filter(a=>rowName(a).toLocaleLowerCase('tr-TR').includes(search.toLocaleLowerCase('tr-TR'))))}{section('enrollments','Dönem kayıtları','Sporcuları gruplara ekleyin ve üyelik tarihlerini yönetin.',[{heading:'Sporcu',render:r=>athleteName(r.athlete_id)},{heading:'Dönem',render:r=>termName(r.group_term_id)},dateColumn('joined_on','Katılım'),dateColumn('left_on','Ayrılış')])}</>}</>}
 {tab==='coaches'&&<><CoachManagement coaches={coaches} onChanged={refresh}/>{section('coach_assignments','Grup görevlendirmeleri','Antrenörün grupta görev yapacağı tarih aralığını belirleyin.',[{heading:'Antrenör',render:r=>coachName(r.coach_id)},{heading:'Dönem',render:r=>termName(r.group_term_id)},dateColumn('starts_on','Başlangıç'),dateColumn('ends_on','Bitiş')])}</>}
 {tab==='sessions'&&(selectedLesson?<LessonDetail lesson={selectedLesson} data={data} coaches={coaches} refresh={refresh} onBack={()=>setLessonId(null)}/>:<section className="panel"><div className="panel-heading"><div><h2>Ders takvimi</h2><p>Tüm antrenörler · Tarih sıralı liste · Türkiye saati</p></div><button className="button small" onClick={()=>open('sessions')}>+ Ders ekle</button></div><DataTable rows={[...data.sessions].sort((a,b)=>String(b.starts_at).localeCompare(String(a.starts_at)))} columns={sessionColumns} actions={sessionActions}/><p className="fine-print table-note">Yeni ders formunda antrenörü ve sporcuları birlikte seçebilirsiniz. Atama yapılmış dersin saati değiştirilemez; iptal edip yeni ders oluşturun.</p></section>)}
 {tab==='plans'&&<>{section('training_plans','Antrenman planları','Genel kulüp planları ve dönemlere özel çalışmalar.',[{heading:'Başlık',render:r=><strong>{r.title}</strong>},{heading:'Kapsam',render:r=>r.group_term_id?termName(r.group_term_id):'Genel kulüp planı'},{heading:'İçerik',render:r=><span className="plan-excerpt">{r.content}</span>}])}{section('schedule_rules','Haftalık ders saatleri','Haftalık program tanımları; somut dersler Ders takvimi ekranından oluşturulur.',[{heading:'Dönem',render:r=>termName(r.group_term_id)},{heading:'Gün',render:r=>['','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi','Pazar'][Number(r.weekday)]},{heading:'Saat / süre',render:r=>`${String(r.local_start_time).slice(0,5)} · ${r.duration_minutes} dk`},dateColumn('valid_from','Başlangıç'),dateColumn('valid_until','Bitiş')])}</>}
 {tab==='content'&&<SiteEditor/>}
 {tab==='reports'&&<Reports coaches={coaches} onExpired={expired}/>}
 </>}
 <footer className="content-footer">Deniz Aslanları Spor Kulübü <span>Tüm saatler Türkiye saatidir.</span></footer>
 </main></div>{createLesson&&data&&<NewLesson data={data} coaches={coaches} onClose={()=>setCreateLesson(false)} onSaved={async id=>{setNotice('Ders ve seçtiğiniz atamalar kaydedildi.');try{await refresh();}catch{setError('Ders kaydedildi; listeleri yenileyin.');}setTab('sessions');setLessonId(id);}}/>}{form&&<RecordForm definition={form} onClose={()=>setForm(null)} onSave={saveForm}/>}</div>;
}
