import {defaultContent} from '../../src/lib/site-content';
import { test, expect, type Page } from '@playwright/test';
const uid=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const resources=['groups','group_terms','athletes','enrollments','coach_assignments','training_plans','schedule_rules','sessions','session_coaches','session_athletes','athlete_attendance'];
type Row=Record<string,unknown>;
async function fixture(page:Page, role='ADMIN', seed:Record<string,Row[]>={}) {
 const data:Record<string,Row[]>=Object.fromEntries(resources.map(t=>[t,seed[t]??[]]));
 const requests:{method:string;resource:string;body:Row}[]=[];
 let loggedIn=true;
 await page.route('**/api/**',async route=>{
  const req=route.request();const url=new URL(req.url());const path=url.pathname;const method=req.method();
  const respond=(body:unknown,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  if(path==='/api/auth/me')return respond(loggedIn?{user:{id:uid(1),display_name:role==='COACH'?'Test Antrenörü':'Test Yöneticisi'},roles:[role]}:{error:'Oturum açmanız gerekiyor.'},loggedIn?200:401);
  if(path==='/api/auth/login'){loggedIn=true;return respond({ok:true});}
  if(path==='/api/auth/logout'){loggedIn=false;return respond({ok:true});}
  if(path==='/api/admin/coaches')return respond({data:[{id:uid(2),display_name:'Test Antrenörü',is_active:true}]});
  if(path==='/api/club/reports')return respond({data:[{session_id:uid(8),starts_at:'2026-01-05T08:00:00Z',ends_at:'2026-01-05T09:00:00Z',status:'COMPLETED',expected:2,recorded:1,present:1,absent:0,excused:0,coaches:[{coach_id:uid(2),participation_status:'UNCONFIRMED'}]}]});
  const resource=path.split('/').at(-1)!;
  if(!data[resource])return respond({error:'Bulunamadı'},404);
  if(method==='GET')return respond({data:data[resource].slice(Number(url.searchParams.get('page')??0)*50,Number(url.searchParams.get('page')??0)*50+50)});
  const body=req.postDataJSON();requests.push({method,resource,body});
  if(method==='POST'){
   const row={id:uid(100+requests.length),...body};
   if(resource==='training_plans')Object.assign(row,{created_by:uid(1)});
   if(resource==='athlete_attendance')Object.assign(row,{recorded_at:new Date().toISOString()});
   data[resource].push(row);return respond({data:[row]},201);
  }
  if(method==='PATCH'){
   const row=data[resource].find(r=>[...url.searchParams.entries()].every(([key,value])=>r[key]===value));
   if(!row)return respond({error:'Bulunamadı'},404);
   Object.assign(row,body);return respond({data:[row]});
  }
  return respond({error:'Desteklenmiyor'},405);
 });
 return {data,requests};
}
test('real unauthenticated admin redirects to login and real API refuses access',async({page,request})=>{
 await page.goto('/admin');await expect(page).toHaveURL(/\/login$/);
 await expect(page.getByRole('heading',{name:'Tekrar hoş geldiniz.'})).toBeVisible();
 expect((await request.get('/api/admin/coaches')).status()).toBe(401);
 expect((await request.get('/api/club/athletes')).status()).toBe(401);
});
test('login routes admin to dashboard; logout returns to login',async({page})=>{
 await fixture(page);await page.goto('/login');
 await page.getByLabel('E-posta adresi').fill('test@example.invalid');await page.getByLabel('Parola',{exact:true}).fill('test-fixture-not-a-real-password');
 await page.getByRole('button',{name:'Panele giriş yap'}).click();
 await expect(page.getByRole('heading',{name:'Genel bakış',exact:true})).toBeVisible();
 await expect(page.getByText('Bugün için planlanmış ders bulunmuyor.')).toBeVisible();
 await page.getByRole('button',{name:'Çıkış yap'}).click();await expect(page).toHaveURL(/\/login$/);
});
test('coach is denied admin UI and no club data is loaded',async({page})=>{
 const {requests}=await fixture(page,'COACH');let clubReads=0;
 page.on('request',r=>{if(r.url().includes('/api/club/'))clubReads++;});
 await page.goto('/admin');await expect(page.getByRole('heading',{name:'Yönetici erişimi gerekli'})).toBeVisible();
 expect(requests).toHaveLength(0);expect(clubReads).toBe(0);
});
test('admin creates group, period and edits dates through forms',async({page})=>{
 const {requests}=await fixture(page);await page.goto('/admin');await page.getByRole('button',{name:'Gruplar ve dönemler',exact:false}).click();
 await page.getByRole('button',{name:'+ Grup ekle',exact:true}).click();
 await page.getByLabel('Grup adı').fill('Başlangıç Yüzme');await page.getByLabel('Branş').selectOption('SWIMMING');await page.getByLabel('Seviye').fill('Başlangıç');
 await page.getByRole('button',{name:'Kaydet',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible();
 await expect(page.getByRole('cell',{name:'Başlangıç Yüzme',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'+ Dönem ekle',exact:true}).click();
 await page.getByLabel('Grup',{exact:false}).filter({visible:true}).first().selectOption({label:'Başlangıç Yüzme'});
 await page.getByLabel('Dönem adı').fill('Kış dönemi');await page.getByLabel('Başlangıç tarihi').fill('2026-11-01');await page.getByLabel('Bitiş tarihi').fill('2027-01-31');await page.getByLabel('Durum').selectOption('ACTIVE');await page.getByRole('button',{name:'Kaydet',exact:true}).click();
 await expect(page.getByRole('dialog')).not.toBeVisible();
 await page.getByRole('row').filter({hasText:'Kış dönemi'}).getByRole('button',{name:/Düzenle/}).click();
 await page.getByLabel('Bitiş tarihi').fill('2027-02-28');await page.getByRole('button',{name:'Kaydet',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible();
 expect(requests.some(r=>r.resource==='group_terms'&&r.method==='PATCH'&&r.body.end_date==='2027-02-28')).toBe(true);
});
test('lesson roster, attendance, participation and CSV reports work',async({page})=>{
 const seed={groups:[{id:uid(3),name:'Yüzme',sport:'SWIMMING',is_active:true}],group_terms:[{id:uid(4),group_id:uid(3),name:'Kış dönemi',start_date:'2026-01-01',end_date:'2026-12-31',status:'ACTIVE'}],athletes:[{id:uid(5),first_name:'Ada',last_name:'Test',is_active:true}],enrollments:[{id:uid(6),group_term_id:uid(4),athlete_id:uid(5),joined_on:'2026-01-01',left_on:null}],coach_assignments:[{id:uid(7),group_term_id:uid(4),coach_id:uid(2),starts_on:'2026-01-01',ends_on:'2026-12-31'}],sessions:[{id:uid(8),group_term_id:uid(4),starts_at:'2026-01-05T08:00:00Z',ends_at:'2026-01-05T09:00:00Z',status:'COMPLETED'}]};
 const {requests}=await fixture(page,'ADMIN',seed);await page.goto('/admin');await page.getByRole('button',{name:'Ders takvimi',exact:false}).first().click();await page.getByRole('button',{name:'Ders detayı',exact:true}).click();
 await page.getByRole('combobox',{name:'Antrenör ekle',exact:true}).selectOption(uid(2));await page.getByRole('button',{name:'Antrenör ata',exact:true}).click();
 await expect(page.locator('.assignment-row strong').filter({hasText:'Test Antrenörü'})).toBeVisible();
 await page.getByLabel('Test Antrenörü katılımı').selectOption('ATTENDED');await expect(page.locator('.assignment-row .badge').filter({hasText:'Katıldı'})).toBeVisible();
 await page.getByLabel('Derse sporcu ekle').selectOption(uid(6));await page.getByRole('button',{name:'Listeye ekle'}).click();await expect(page.getByRole('cell',{name:'Ada Test',exact:true})).toBeVisible();
 await page.getByLabel('Ada Test yoklama durumu').selectOption('PRESENT');await page.getByRole('button',{name:'Kaydet',exact:true}).click();await expect(page.getByRole('cell',{name:'Var',exact:true})).toBeVisible();
 expect(requests.some(r=>r.resource==='athlete_attendance'&&r.body.status==='PRESENT')).toBe(true);
 await page.getByText('Programlar ve raporlar',{exact:true}).click();await page.getByRole('button',{name:'Yoklama ve raporlar',exact:false}).click();
 await page.getByLabel('Başlangıç',{exact:true}).fill('2026-01-01');await page.getByLabel('Bitiş (dahil)').fill('2026-01-31');await page.getByRole('button',{name:'Raporu getir'}).click();
 await expect(page.getByText('Doğrulanmadı',{exact:true})).toBeVisible();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'CSV indir'}).click();expect((await download).suggestedFilename()).toContain('2026-01-01');
});
test('mobile login and admin fit viewport; dialog supports Escape',async({page})=>{
 await page.setViewportSize({width:390,height:844});await fixture(page);
 await page.goto('/login');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/login-mobile.png',fullPage:true});
 await page.goto('/admin');await expect(page.getByRole('heading',{name:'Genel bakış',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/admin-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'Gruplar ve dönemler',exact:false}).click();await page.getByRole('button',{name:'+ Grup ekle',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible();
});
test('desktop screenshots and no browser errors',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1440,height:1000});await fixture(page);await page.goto('/login');
 await page.screenshot({path:'test-results/login-desktop.png',fullPage:true});await page.goto('/admin');await expect(page.getByRole('heading',{name:'Genel bakış',exact:true})).toBeVisible();await page.screenshot({path:'test-results/admin-desktop.png',fullPage:true});expect(errors).toEqual([]);
});


test('public homepage desktop and mobile navigation and contact work',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1487,height:1058});await page.goto('/');
 await expect(page.getByRole('heading',{name:/Birlikte daha güçlü/})).toBeVisible();
 await page.evaluate(()=>document.fonts.ready);await page.waitForFunction(()=>[...document.images].filter(i=>i.loading!=='lazy').every(i=>i.complete&&i.naturalWidth>0));
 await page.screenshot({path:'test-results/homepage-desktop.png',fullPage:false});
 await page.getByRole('link',{name:'Deneme dersine başvur',exact:true}).first().click();await expect(page).toHaveURL(/\/basvuru$/);await expect(page.getByRole('form',{name:'Deneme dersi başvuru formu'})).toBeVisible();
 await expect(page.locator('a[href="tel:+905459477973"]').first()).toBeVisible();
 await page.setViewportSize({width:390,height:844});await page.goto('/');
 await page.getByRole('button',{name:'Menü',exact:true}).click();await page.getByRole('navigation',{name:'Ana menü'}).getByRole('link',{name:'Eğitimler'}).click();await expect(page).toHaveURL(/\/programlar$/);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.goto('/');await page.screenshot({path:'test-results/homepage-mobile.png',fullPage:true});expect(errors).toEqual([]);
});
test('CMS admin edits text, uploads image and publishes with revision; conflict preserves edits',async({page})=>{
 await fixture(page);let stored={...defaultContent};let revision=0;
 await page.route('**/api/admin/content',async route=>{
  if(route.request().method()==='PUT'){
   const body=route.request().postDataJSON();
   if(body.revision!==revision)return route.fulfill({status:409,json:{error:'İçerik başka bir oturumda değişti.'}});
   stored=body.content;revision++;return route.fulfill({json:{revision}});
  }
  return route.fulfill({json:{content:stored,revision}});
 });
 await page.route('https://example.com/swimmer.png',route=>route.fulfill({path:'public/images/swimming.png',contentType:'image/png'}));
 await page.route('**/api/admin/media',route=>route.fulfill({status:201,json:{url:'https://example.com/swimmer.png'}}));
 await page.goto('/admin');await page.getByRole('button',{name:'Site içeriği',exact:false}).click();
 await expect(page.getByLabel('Ana başlık (satır sonu kullanılabilir)')).toBeVisible();
 await page.screenshot({path:'test-results/site-editor-desktop.png',fullPage:true});
 await page.getByLabel('Ana başlık (satır sonu kullanılabilir)').fill('Yeni ana başlık');
 await page.getByRole('button',{name:'Kaydet ve yayımla'}).click();await expect(page.getByRole('status')).toContainText('kaydedildi ve web sitesinde yayımlandı');expect(stored.heroTitle).toBe('Yeni ana başlık');expect(revision).toBe(1);
 await expect(page.getByLabel('Ana görsel yükle',{exact:true})).toBeEnabled();
 await page.getByLabel('Ana görsel yükle',{exact:true}).setInputFiles('public/images/monogram.png');
 await expect(page.getByRole('status')).toContainText('Görsel yüklendi');expect(stored.heroImage).toBe('/images/hero.png');
 await page.getByRole('button',{name:'Kaydet ve yayımla'}).click();await expect(page.getByRole('status')).toContainText('kaydedildi');expect(stored.heroImage).toBe('https://example.com/swimmer.png');
 await page.getByLabel('Düzenlenecek sayfa').selectOption('/hakkimizda');await page.getByLabel('Sayfa başlığı',{exact:true}).fill('Kulübümüzü tanıyın');await page.getByLabel('Sayfa metni',{exact:true}).fill('## Kulübümüz\n\nGüncel kulüp bilgileri.');await page.getByRole('button',{name:'Kaydet ve yayımla'}).click();await expect(page.getByRole('status')).toContainText('kaydedildi');expect(stored.pageOverrides['/hakkimizda'].title).toBe('Kulübümüzü tanıyın');
 await page.getByRole('button',{name:'Orijinal içeriği kullan'}).click();await page.getByRole('button',{name:'Kaydet ve yayımla'}).click();await expect(page.getByRole('status')).toContainText('kaydedildi');expect(stored.pageOverrides['/hakkimizda']).toBeUndefined();
 await page.getByLabel('Ana sayfanın içerik dili',{exact:true}).selectOption('en');await page.getByLabel('Ana başlık (satır sonu kullanılabilir)').fill('English club title');await page.getByRole('button',{name:'Kaydet ve yayımla'}).click();await expect(page.getByRole('status')).toContainText('kaydedildi');expect(stored.localizedText.en?.heroTitle).toBe('English club title');expect(stored.heroTitle).toBe('Yeni ana başlık');await page.getByLabel('Ana sayfanın içerik dili',{exact:true}).selectOption('tr');
 revision++;await page.getByLabel('Ana başlık (satır sonu kullanılabilir)').fill('Çakışan taslak');await page.getByRole('button',{name:'Kaydet ve yayımla'}).click();await expect(page.locator('.site-editor [role=alert]')).toContainText('başka bir oturumda');expect(stored.heroTitle).toBe('Yeni ana başlık');
});


function coachSeed(future=false):Record<string,Row[]>{
 const year=new Date().getUTCFullYear(),start=`${year}-01-01`,end=`${year+1}-12-31`;
 return {groups:[{id:uid(3),name:'Kendi grubum'},{id:uid(30),name:'Başka grup'}],group_terms:[{id:uid(4),group_id:uid(3),name:'Yüzme dönemi',start_date:start,end_date:end,status:'ACTIVE'},{id:uid(40),group_id:uid(30),name:'Başka dönem'}],athletes:[{id:uid(5),first_name:'Ada',last_name:'Test',is_active:true},{id:uid(15),first_name:'Ege',last_name:'Test',is_active:true},{id:uid(50),first_name:'Gizli',last_name:'Sporcu',is_active:true}],enrollments:[{id:uid(6),group_term_id:uid(4),athlete_id:uid(5),joined_on:start},{id:uid(16),group_term_id:uid(4),athlete_id:uid(15),joined_on:start},{id:uid(60),group_term_id:uid(40),athlete_id:uid(50),joined_on:start}],coach_assignments:[{id:uid(7),group_term_id:uid(4),coach_id:uid(1),starts_on:start,ends_on:end},{id:uid(70),group_term_id:uid(40),coach_id:uid(2),starts_on:start,ends_on:end}],sessions:[{id:uid(8),group_term_id:uid(4),starts_at:new Date(Date.now()+(future?86400000:-7200000)).toISOString(),ends_at:new Date(Date.now()+(future?90000000:-3600000)).toISOString(),status:'SCHEDULED'},{id:uid(80),group_term_id:uid(40),starts_at:new Date().toISOString(),ends_at:new Date(Date.now()+3600000).toISOString(),status:'SCHEDULED'}],session_coaches:[{session_id:uid(8),coach_id:uid(1),participation_status:'UNCONFIRMED'},{session_id:uid(80),coach_id:uid(2),participation_status:'ATTENDED'}],session_athletes:[{session_id:uid(8),athlete_id:uid(5),enrollment_id:uid(6)},{session_id:uid(8),athlete_id:uid(15),enrollment_id:uid(16)}],training_plans:[{id:uid(9),group_term_id:null,title:'Genel teknik',content:'Genel kulüp programı',created_by:uid(2)}]};
}
test('coach login routes to own dashboard and hides unrelated records',async({page})=>{
 await fixture(page,'COACH',coachSeed());await page.goto('/login');await page.getByLabel('E-posta adresi').fill('coach@example.invalid');await page.getByLabel('Parola',{exact:true}).fill('fixture-only-password');await page.getByRole('button',{name:'Panele giriş yap'}).click();await expect(page).toHaveURL(/\/coach$/);await expect(page.getByRole('heading',{name:'Derslerim',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Sporcu talepleri',exact:true}).click();await page.getByText('Gruba kayıtlı sporcularım',{exact:true}).click();await expect(page.getByRole('cell',{name:'Ada Test'})).toBeVisible();await expect(page.getByText('Gizli Sporcu')).toHaveCount(0);await expect(page.getByRole('button',{name:'Site içeriği',exact:false})).toHaveCount(0);
});
test('coach bulk attendance keeps failed selections, retries and confirms saved records',async({page})=>{
 const {data}=await fixture(page,'COACH',coachSeed());let attempts=0;
 await page.route('**/api/coach/attendance',async route=>{
  attempts++;if(attempts===1)return route.fulfill({status:403,json:{error:'Düzenleme yetkiniz yok. Seçimleriniz kaydedilmedi.'}});
  const payload=route.request().postDataJSON();for(const entry of payload.entries)data.athlete_attendance.push({...entry,session_id:payload.session_id,recorded_by:uid(1),recorded_at:new Date().toISOString()});return route.fulfill({json:{data:data.athlete_attendance}});
 });
 await page.goto('/coach');await page.getByRole('button',{name:'Derslerim',exact:false}).click();await expect(page.getByText('Başka dönem',{exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Yoklamayı aç'}).click();await page.getByRole('group',{name:'Ada Test yoklaması',exact:true}).getByRole('button',{name:'Var',exact:true}).click();await page.getByRole('group',{name:'Ege Test yoklaması',exact:true}).getByRole('button',{name:'Mazeretli',exact:true}).click();
 page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'Sporcu talepleri',exact:true}).click();await expect(page.getByRole('group',{name:'Ada Test yoklaması',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Seçilenleri kaydet'}).click();await expect(page.locator('p[role=alert]')).toContainText('kaydedilmedi');expect(data.athlete_attendance).toHaveLength(0);await expect(page.getByRole('group',{name:'Ada Test yoklaması',exact:true}).getByRole('button',{name:'Var',exact:true})).toHaveAttribute('aria-pressed','true');await page.getByRole('button',{name:'Seçilenleri kaydet'}).click();await expect(page.getByRole('status')).toContainText('2 sporcunun yoklaması kaydedildi');expect(data.athlete_attendance).toHaveLength(2);
 await page.evaluate(()=>{window.scrollTo(0,0);(document.activeElement as HTMLElement)?.blur();});
 await page.screenshot({path:'test-results/coach-attendance-desktop.png',fullPage:true});
});
test('coach adds own group plan; general plan stays read-only',async({page})=>{
 const {requests}=await fixture(page,'COACH',coachSeed());await page.goto('/coach');await page.getByText('Antrenman planlarım',{exact:true}).click();await expect(page.getByRole('row').filter({hasText:'Genel teknik'}).getByText('Salt okunur')).toBeVisible();await page.getByRole('button',{name:'+ Plan ekle'}).click();await page.getByRole('dialog').getByRole('combobox').selectOption(uid(4));await page.getByLabel('Plan başlığı').fill('Nefes çalışması');await page.getByLabel('Antrenman içeriği').fill('Teknik ve nefes kontrolü.');await page.getByRole('button',{name:'Kaydet',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible();await expect(page.getByRole('cell',{name:'Nefes çalışması',exact:true})).toBeVisible();expect(requests.some(r=>r.resource==='training_plans'&&r.body.group_term_id===uid(4))).toBe(true);
});
test('future coach lesson is read-only and mobile roster fits',async({page})=>{
 await page.setViewportSize({width:390,height:844});await fixture(page,'COACH',coachSeed(true));await page.goto('/coach');await page.getByRole('button',{name:'Derslerim',exact:false}).click();await page.getByRole('button',{name:'Yoklamayı aç'}).click();await expect(page.getByText('Ders başlamadan yoklama alınamaz.')).toBeVisible();await expect(page.getByRole('group',{name:'Ada Test yoklaması',exact:true}).getByRole('button',{name:'Var',exact:true})).toBeDisabled();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'test-results/coach-mobile.png',fullPage:true});
});
test('coach route rejects admin-only role and redirects anonymous session',async({page})=>{
 await fixture(page,'ADMIN');await page.goto('/coach');await expect(page.getByRole('heading',{name:'Antrenör hesabı gerekli'})).toBeVisible();await page.unrouteAll();await page.goto('/coach');await expect(page).toHaveURL(/\/login$/);
});

test('simplified coach has three sections and saves profile name and private photo',async({page})=>{
 await page.setViewportSize({width:390,height:844});await fixture(page,'COACH',coachSeed());
 let profile={display_name:'Test Antrenörü',email:'coach@example.invalid',phone:null as string|null,city:null as string|null,specialization:null,bio:null,avatar_path:null as string|null,avatar_url:null as string|null};
 await page.route('**/api/coach/profile',async route=>{if(route.request().method()==='PUT'){profile={...profile,...route.request().postDataJSON()};profile.avatar_url=profile.avatar_path?'/images/monogram.png':null;}return route.fulfill({json:route.request().method()==='PUT'?{ok:true}:{data:profile}});});
 await page.route('**/api/coach/avatar',route=>route.fulfill({status:201,json:{path:uid(1)+'/photo.png',url:'/images/monogram.png'}}));
 await page.goto('/coach');await expect(page.getByRole('navigation',{name:'Antrenör menüsü'}).getByRole('button')).toHaveCount(3);
 await page.getByRole('button',{name:'Profilim',exact:true}).click();await page.getByLabel('Ad soyad',{exact:true}).fill('Yeni Antrenör');await page.getByLabel('Telefon',{exact:true}).fill('05551234567');await page.getByLabel('Şehir',{exact:true}).fill('Alanya');
 await page.getByLabel('Profil fotoğrafı yükle',{exact:true}).setInputFiles('public/images/monogram.png');await expect(page.getByRole('status')).toContainText('Fotoğraf yüklendi');await page.getByRole('button',{name:'Kaydet',exact:true}).click();await expect(page.getByRole('status')).toContainText('Profiliniz kaydedildi');
 await expect(page.locator('.account strong')).toHaveText('Yeni Antrenör');expect(profile.avatar_path).toContain('/photo.png');expect(profile.phone).toBe('05551234567');await expect(page.getByAltText('Profil fotoğrafınız')).toBeVisible();await page.evaluate(()=>{(document.activeElement as HTMLElement)?.blur();window.scrollTo(0,0);});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/coach-profile-mobile.png',fullPage:true});
});
test('coach sends a contextual athlete request without adding an active athlete',async({page})=>{
 const {data}=await fixture(page,'COACH',coachSeed());const rows:Row[]=[];let submitted:Row={};
 await page.route('**/api/coach/athlete-requests**',async route=>{if(route.request().method()==='POST'){submitted=route.request().postDataJSON();rows.push({id:uid(200),coach_id:uid(1),...submitted,status:'PENDING'});return route.fulfill({status:201,json:{data:rows.at(-1)}});}return route.fulfill({json:{data:rows}});});
 await page.goto('/coach');await page.getByRole('button',{name:'Yoklamayı aç'}).click();await page.getByRole('button',{name:'+ Sporcu talebi',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('Bu derse sporcu ekleme talebi');
 await page.getByLabel('Sporcu adı',{exact:false}).fill('Yeni');await page.getByLabel('Sporcu soyadı',{exact:false}).fill('Sporcu');await page.getByRole('button',{name:'Onaya gönder'}).click();await expect(page.getByRole('dialog')).not.toBeVisible();expect(submitted.session_id).toBe(uid(8));expect(data.athletes).toHaveLength(3);expect(data.session_athletes).toHaveLength(2);
 await page.getByRole('button',{name:'Sporcu talepleri',exact:true}).click();await expect(page.getByText('Yeni Sporcu',{exact:true})).toBeVisible();await expect(page.getByText('Onay bekliyor',{exact:true})).toBeVisible();await page.screenshot({path:'test-results/coach-requests-desktop.png',fullPage:true});
});
test('admin creates lesson, coach assignment and roster in a single form',async({page})=>{
 const seed=coachSeed();seed.coach_assignments=[];await fixture(page,'ADMIN',seed);let payload:Row={};
 await page.route('**/api/admin/lessons',async route=>{payload=route.request().postDataJSON();return route.fulfill({status:201,json:{data:[{id:uid(210),...payload}]}});});
 await page.goto('/admin');await page.getByRole('button',{name:'+ Ders oluştur',exact:true}).click();await page.getByRole('dialog').getByRole('combobox').first().selectOption(uid(4));await page.getByLabel('Başlangıç (Türkiye saati)').fill('2026-11-07T12:00');await page.getByLabel('Bitiş (Türkiye saati)').fill('2026-11-07T13:00');await page.getByLabel(/Bu antrenör bu tarihte/).check();await page.getByLabel('Ada Test',{exact:true}).check();await page.screenshot({path:'test-results/admin-single-lesson.png',fullPage:true});await page.getByRole('button',{name:'Dersi oluştur',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible();expect(payload.coach_id).toBe(uid(2));expect(payload.athlete_ids).toEqual([uid(5)]);expect(payload.create_assignment).toBe(true);expect(payload.starts_at).toBe('2026-11-07T09:00:00.000Z');
});
test('admin reviews athlete requests and requires reason for rejection',async({page})=>{
 await fixture(page,'ADMIN',coachSeed());const rows=[{id:uid(220),coach_id:uid(2),group_term_id:uid(4),session_id:null,first_name:'Yeni',last_name:'Sporcu',joined_on:'2026-11-05',status:'PENDING',note:'Deneme dersi'}];const decisions:Row[]=[];
 await page.route('**/api/admin/athlete-requests**',async route=>{if(route.request().method()==='POST'){const body=route.request().postDataJSON();decisions.push(body);rows[0].status=body.decision;return route.fulfill({json:{athlete_id:uid(230)}});}return route.fulfill({json:{data:rows}});});
 await page.goto('/admin');await page.getByRole('button',{name:'Sporcu taleplerini incele'}).click();await expect(page.getByText('Yeni Sporcu',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Reddet',exact:true}).click();await page.getByRole('button',{name:'Talebi reddet',exact:true}).click();expect(decisions).toHaveLength(0);await page.getByLabel('Ret gerekçesi',{exact:false}).fill('Veli bilgisi eksik.');await page.getByRole('button',{name:'Talebi reddet',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible();expect(decisions[0].review_message).toBe('Veli bilgisi eksik.');
 rows[0].status='PENDING';await page.getByRole('button',{name:'Yenile',exact:true}).last().click();await page.getByRole('button',{name:'Onayla',exact:true}).click();await page.getByLabel('Mevcut sporcu ile eşleştir',{exact:false}).selectOption(uid(5));await page.getByRole('button',{name:'Onayla ve gruba ekle'}).click();await expect(page.getByRole('dialog')).not.toBeVisible();expect(decisions[1].existing_athlete).toBe(uid(5));await expect(page.getByRole('status')).toContainText('onaylandı');
});

test('admin invites coach from panel, replaces and revokes invitation',async({page})=>{
 await fixture(page);const token='a'.repeat(64);const rows:Row[]=[];const actions:Row[]=[];
 await page.route('**/api/admin/coach-invitations**',async route=>{
  const method=route.request().method();
  if(method==='POST'){
   const body=route.request().postDataJSON();actions.push({method,...body});rows.forEach(r=>r.status='REVOKED');
   const row={id:uid(300+actions.length),...body,status:'PENDING',expires_at:new Date(Date.now()+7*86400000).toISOString()};rows.push(row);
   return route.fulfill({status:201,json:{id:row.id,url:'https://club.example/invite/'+token}});
  }
  if(method==='DELETE'){const body=route.request().postDataJSON();actions.push({method,...body});rows.find(r=>r.id===body.id)!.status='REVOKED';return route.fulfill({json:{ok:true}});}
  return route.fulfill({json:{data:rows}});
 });
 await page.goto('/admin');await page.getByRole('button',{name:'Antrenörler',exact:true}).click();
 await page.getByRole('button',{name:'+ Antrenör davet et',exact:true}).click();await page.getByLabel('Ad soyad',{exact:false}).fill('Yeni Antrenör');await page.getByLabel('E-posta adresi',{exact:false}).fill('yeni@example.com');await page.getByRole('button',{name:'Davet bağlantısı oluştur',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible();await expect(page.getByLabel('Davet bağlantısı',{exact:true})).toHaveValue('https://club.example/invite/'+token);await expect(page.getByText('yeni@example.com',{exact:true})).toBeVisible();
 expect(actions[0]).toEqual({method:'POST',email:'yeni@example.com',display_name:'Yeni Antrenör'});
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Yeni bağlantı',exact:true}).click();expect(actions.filter(a=>a.method==='POST')).toHaveLength(2);
 await page.evaluate(()=>{(document.activeElement as HTMLElement)?.blur();window.scrollTo(0,0);});await page.screenshot({path:'test-results/admin-coach-invitation.png',fullPage:true});await page.getByRole('button',{name:'Daveti iptal et',exact:true}).click();await expect(page.getByText('Bekleyen davet yok.',{exact:true})).toBeVisible();expect(actions.at(-1)?.method).toBe('DELETE');
});
test('admin edits coach name and active state from panel',async({page})=>{
 await page.setViewportSize({width:390,height:844});await fixture(page);let payload:Row={};
 await page.route('**/api/admin/coach-invitations**',r=>r.fulfill({json:{data:[]}}));
 await page.route('**/api/admin/coaches',async route=>{if(route.request().method()==='PATCH'){payload=route.request().postDataJSON();return route.fulfill({json:{ok:true}});}return route.fulfill({json:{data:[{id:uid(2),display_name:payload.display_name??'Test Antrenörü',is_active:payload.is_active??true}]}});});
 await page.goto('/admin');await page.getByRole('button',{name:'Antrenörler',exact:true}).click();await page.getByRole('button',{name:'Hesabı düzenle',exact:false}).click();await page.getByLabel('Ad soyad',{exact:false}).fill('Düzenlenen Antrenör');await page.getByLabel('Hesap aktif',{exact:true}).uncheck();await page.getByRole('button',{name:'Kaydet',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible();expect(payload).toEqual({id:uid(2),display_name:'Düzenlenen Antrenör',is_active:false});await expect(page.getByRole('cell',{name:'Pasif',exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.evaluate(()=>{(document.activeElement as HTMLElement)?.blur();window.scrollTo(0,0);});await page.screenshot({path:'test-results/admin-coach-management-mobile.png',fullPage:true});
});
test('new coach chooses password, confirms email and accepts invitation before entering panel',async({page})=>{
 await fixture(page,'COACH',coachSeed());const token='b'.repeat(64);let user:null|{email:string;confirmed:boolean}=null;const submissions:Row[]=[];
 await page.route('**/api/invitations?*',route=>route.fulfill({json:{invitation:{email:'coach@example.com',display_name:'Yeni Antrenör',status:'PENDING',expires_at:new Date(Date.now()+86400000).toISOString()},user}}));
 await page.route('**/api/invitations/session',async route=>{submissions.push(route.request().postDataJSON());return route.fulfill({json:{needs_confirmation:true}});});
 let accepts=0;await page.route('**/api/invitations/accept',async route=>{accepts++;return route.fulfill({json:{ok:true}});});
 await page.goto('/invite/'+token);await expect(page.getByText('coach@example.com',{exact:true})).toBeVisible();await page.getByLabel('Yeni parola',{exact:false}).fill('fixture-new-password');await page.getByLabel('Parolayı tekrar girin',{exact:false}).fill('fixture-new-password');await page.getByRole('button',{name:'Hesabımı oluştur'}).click();await expect(page.getByRole('status')).toContainText('doğrulama bağlantısını');expect(accepts).toBe(0);expect(submissions[0]).toEqual({token,action:'signup',password:'fixture-new-password'});
 user={email:'coach@example.com',confirmed:true};await page.goto('/invite/'+token);await page.getByRole('button',{name:'Daveti kabul et ve panele geç'}).click();await expect(page).toHaveURL(/\/coach$/);expect(accepts).toBe(1);
});
test('invited existing user signs in, failed invitation keeps form and retry succeeds',async({page})=>{
 await page.setViewportSize({width:390,height:844});await fixture(page,'COACH',coachSeed());const token='c'.repeat(64);let attempts=0;let payload:Row={};
 await page.route('**/api/invitations?*',route=>route.fulfill({json:{invitation:{email:'existing@example.com',display_name:'Mevcut Antrenör',status:'PENDING'},user:null}}));
 await page.route('**/api/invitations/session',async route=>{attempts++;payload=route.request().postDataJSON();return route.fulfill(attempts===1?{status:403,json:{error:'Bu davet hesabınıza ait değil.'}}:{json:{ok:true}});});
 await page.goto('/invite/'+token);await page.getByRole('button',{name:'Zaten hesabım var',exact:true}).click();await page.getByLabel('Mevcut parola',{exact:false}).fill('existing-fixture-password');await page.getByRole('button',{name:'Giriş yap ve daveti kabul et'}).click();await expect(page.locator('p[role=alert]')).toContainText('hesabınıza ait değil');await expect(page.getByLabel('Mevcut parola',{exact:false})).toHaveValue('existing-fixture-password');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.evaluate(()=>{(document.activeElement as HTMLElement)?.blur();window.scrollTo(0,0);});await page.screenshot({path:'test-results/coach-invitation-mobile.png',fullPage:true});await page.getByRole('button',{name:'Giriş yap ve daveti kabul et'}).click();await expect(page).toHaveURL(/\/coach$/);expect(payload.action).toBe('signin');
});
test('revoked invitation has no signup controls; callback rejects external redirect',async({page,request})=>{
 const token='d'.repeat(64);await page.route('**/api/invitations?*',r=>r.fulfill({status:404,json:{error:'Davet geçersiz veya iptal edilmiş.'}}));
 await page.goto('/invite/'+token);await expect(page.locator('p[role=alert]')).toContainText('iptal edilmiş');await expect(page.getByRole('button',{name:'Hesabımı oluştur'})).toHaveCount(0);
 const invitePage=await request.get('/invite/'+token);expect(invitePage.headers()['referrer-policy']).toBe('no-referrer');expect(invitePage.headers()['x-robots-tag']).toBe('noindex, nofollow');
 const callback=await request.get('/auth/callback?next=https://evil.example',{maxRedirects:0});expect(callback.status()).toBe(303);expect(new URL(callback.headers().location).pathname).toBe('/login');expect(callback.headers()['referrer-policy']).toBe('no-referrer');
 const guarded=await request.post('/api/admin/coach-invitations',{data:{},headers:{Origin:'https://evil.example'}});expect(guarded.status()).toBe(403);
 expect((await request.get('/api/admin/coach-invitations')).status()).toBe(401);
});

test('trial CTA reaches a fillable form, preserves failed submission and confirms only accepted requests',async({page})=>{
 await page.setViewportSize({width:390,height:844});const submissions:Row[]=[];
 await page.route('https://api.web3forms.com/submit',async route=>{
  const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'};
  if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers});
  submissions.push(route.request().postDataJSON());
  if(submissions.length===2)return route.abort('failed');
  return route.fulfill(submissions.length===1?{status:503,headers,json:{success:false}}:{headers,json:{success:true}});
 });
 await page.goto('/');await page.getByRole('link',{name:'Deneme dersine başvur',exact:true}).first().click();await expect(page).toHaveURL(/\/basvuru$/);await expect(page.getByRole('heading',{name:'Deneme dersine başvurun',exact:true})).toBeVisible();
 const form=page.getByRole('form',{name:'Deneme dersi başvuru formu'});
 await form.getByRole('button',{name:'Başvuruyu gönder',exact:true}).click();expect(submissions).toHaveLength(0);
 await form.getByLabel('Ad soyad',{exact:true}).fill('Örnek Veli');await form.getByLabel('Telefon numarası',{exact:true}).fill('05551234567');await form.getByRole('combobox',{name:'Başvuru kimin için?',exact:false}).selectOption('CHILD');await form.getByLabel('Çocuğun yaşı',{exact:true}).fill('8');await form.getByRole('combobox',{name:'Ders tercihi',exact:false}).selectOption('SWIMMING');await form.getByLabel('Notunuz (isteğe bağlı)',{exact:true}).fill('Hafta sonu için bilgi istiyorum.');await form.getByRole('checkbox').check();
 await form.getByRole('button',{name:'Başvuruyu gönder',exact:true}).click();await expect(form.getByRole('alert')).toContainText('Bilgileriniz korunuyor');await expect(form.getByLabel('Ad soyad',{exact:true})).toHaveValue('Örnek Veli');await expect(page.getByText('Başvurunuz gönderildi.',{exact:true})).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.locator('#basvuru').screenshot({path:'test-results/trial-form-mobile.png'});
 await form.getByRole('button',{name:'Başvuruyu gönder',exact:true}).click();await expect(form.getByRole('alert')).toContainText('Bağlantı kurulamadı');
 await form.getByRole('button',{name:'Başvuruyu gönder',exact:true}).click();await expect(page.getByRole('status')).toContainText('Başvurunuz gönderildi.');expect(submissions).toHaveLength(3);expect(submissions[2].child_age).toBe('8');expect(submissions[2].lesson_type).toBe('Yüzme');expect(submissions[2].phone).toBe('05551234567');
 await page.getByRole('button',{name:'Yeni başvuru oluştur',exact:true}).click();await expect(page.getByLabel('Ad soyad',{exact:true})).toHaveValue('');await expect(page.getByLabel('Çocuğun yaşı',{exact:true})).toHaveCount(0);
 await page.setViewportSize({width:1440,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.locator('#basvuru').screenshot({path:'test-results/trial-form-desktop.png'});
});
