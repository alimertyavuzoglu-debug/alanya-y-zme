import { type ClubData, type Coach, type RecordRow, rowName } from '@/lib/club-client';
import type { Field, FormDefinition, Option } from './record-form';
export function definitions(data: ClubData, coaches:Coach[]): Record<string,FormDefinition> {
 const opts=(table:string,fn:(r:RecordRow)=>string=rowName):Option[] => (data[table]??[]).map(r=>({value:String(r.id),label:fn(r)}));
 const termName=(id:unknown)=>String(data.group_terms?.find(t=>t.id===id)?.name??'Dönem');
 const select=(key:string,label:string,options:Option[],extra:Partial<Field>={}):Field=>({key,label,type:'select',options,...extra});
 const input=(key:string,label:string,type:Field['type']='text',extra:Partial<Field>={}):Field=>({key,label,type,...extra});
 const periods=opts('group_terms',r=>`${rowName(data.groups?.find(g=>g.id===r.group_id))} · ${r.name}`);
 const activeCoaches=coaches.filter(c=>c.is_active).map(c=>({value:c.id,label:c.display_name}));
 const groupTerm=select('group_term_id','Grup / dönem',periods,{immutable:true});
 return {
  groups:{resource:'groups',title:'Grup',fields:[input('name','Grup adı'),select('sport','Branş',[{value:'SWIMMING',label:'Yüzme'},{value:'TRIATHLON',label:'Triatlon'}]),input('level','Seviye','text',{optional:true,nullable:true}),input('is_active','Aktif grup','checkbox')]},
  group_terms:{resource:'group_terms',title:'Dönem',fields:[select('group_id','Grup',opts('groups'),{immutable:true}),input('name','Dönem adı'),input('start_date','Başlangıç tarihi','date'),input('end_date','Bitiş tarihi','date'),select('status','Durum',[{value:'DRAFT',label:'Taslak'},{value:'ACTIVE',label:'Aktif'},{value:'CLOSED',label:'Kapalı'}])]},
  athletes:{resource:'athletes',title:'Sporcu',fields:[input('first_name','Ad','text',{max:100}),input('last_name','Soyad','text',{max:100}),input('birth_date','Doğum tarihi','date',{optional:true,nullable:true}),input('is_active','Aktif sporcu','checkbox')]},
  enrollments:{resource:'enrollments',title:'Sporcu grup kaydı',fields:[groupTerm,select('athlete_id','Sporcu',opts('athletes'),{immutable:true}),input('joined_on','Katılım tarihi','date'),input('left_on','Ayrılış tarihi','date',{optional:true,nullable:true})]},
  coach_assignments:{resource:'coach_assignments',title:'Antrenör görevlendirmesi',hint:'Antrenörün hesabı önce Supabase Authentication ve COACH rolü ile tanımlanmalıdır.',fields:[groupTerm,select('coach_id','Antrenör',activeCoaches,{immutable:true}),input('starts_on','Görev başlangıcı','date'),input('ends_on','Görev bitişi','date')]},
  training_plans:{resource:'training_plans',title:'Antrenman planı',hint:'Grup / dönem boş bırakılırsa tüm kulüp için genel plan oluşturulur.',fields:[{...groupTerm,optional:true,nullable:true},input('title','Plan başlığı','text',{max:200}),input('content','Antrenman içeriği','textarea',{max:20000})]},
  schedule_rules:{resource:'schedule_rules',title:'Haftalık ders saati',hint:'Bu kayıt haftalık programı tanımlar. Takvimdeki somut dersleri Dersler ekranından ayrıca oluşturun; otomatik tekrar üretimi henüz etkin değildir.',fields:[groupTerm,select('weekday','Gün',['Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi','Pazar'].map((label,i)=>({value:String(i+1),label}))),input('local_start_time','Başlangıç saati','time'),input('duration_minutes','Süre (dakika)','number',{min:1,max:720}),input('valid_from','Geçerlilik başlangıcı','date'),input('valid_until','Geçerlilik bitişi','date')]},
  sessions:{resource:'sessions',title:'Ders',hint:'Saatler Türkiye saatine göredir. Kaydettikten sonra ders detayından antrenörü ve sporcu listesini ekleyin.',fields:[groupTerm,select('training_plan_id','Antrenman planı',opts('training_plans',r=>`${r.group_term_id?termName(r.group_term_id):'Genel'} · ${r.title}`),{optional:true,nullable:true}),input('starts_at','Başlangıç (Türkiye saati)','datetime-local'),input('ends_at','Bitiş (Türkiye saati)','datetime-local'),select('status','Durum',[{value:'SCHEDULED',label:'Planlandı'},{value:'COMPLETED',label:'Tamamlandı'},{value:'CANCELLED',label:'İptal'}])] },
 };
}
