# Deniz Aslanları — Aşama 3: Yönetici Paneli

Next.js 15 / TypeScript / Supabase PostgreSQL + Auth. Giriş ekranı ve yönetici paneli uygulandı. Antrenör paneli sonraki aşamaya bırakıldı. Mevcut tanıtım sitesi değiştirilmedi veya yayımlanmadı. Orijinal sitenin kaynak kodu elimizde değildir.

## Yerel çalışma

Node.js 22 veya 24 kullanın. Mevcut checkout ile çalışın; ayrıca Git worktree oluşturmak gerekmez.

```bash
npm ci
# .env.example içindeki isimleri kullanarak .env.local oluşturun.
npm run dev -- --hostname 0.0.0.0 --port 3000
```

Gerekli ortam değişkenleri:

- NEXT_PUBLIC_SUPABASE_URL: Supabase proje URL'si.
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: Supabase publishable veya eski anon anahtarı. Bu anahtar tek başına yönetici erişimi vermez; RLS zorunludur.

Üretimde `APP_ORIGIN` değerini sitenin kesin HTTPS origin adresine ayarlayın (sonunda `/` olmadan); ters proxy arkasında CSRF doğrulamasında kullanılır. Yerelde Host başlığı ve istek protokolü kullanılır.

Service-role anahtarı uygulama için kullanılmaz. .env.local Git'e alınmaz. Anahtar, parola ve oturum içerikleri loglanmamalıdır.

## Supabase kurulumu — ilk kez

1. https://supabase.com/dashboard üzerinden bir proje oluşturun. Veritabanı parolasını güvenli bir yerde saklayın.
2. Connect veya Settings / API bölümünden Project URL ve Publishable key değerlerini alın. Supabase arayüzüne göre bölüm isimleri değişebilir.
3. Ortam ayarlarına yukarıdaki değişkenleri ekleyin; çalışan Next.js sürecini yeniden başlatın.
4. Yeni projede `supabase/migrations/` içindeki SQL dosyalarını dosya adı sırasıyla uygulayın (001 ve 002). SQL Editor kullanıyorsanız her dosyayı **tek transaction** içinde uygulayın: başına `BEGIN;`, sonuna `COMMIT;` ekleyin. Bu migration tek seferliktir; tekrar çalıştırmayın. Daha önce migration kullanılan projede bunun yerine Supabase CLI `supabase db push` ve migration geçmişini kullanın. Yeni ve bu uygulamaya ayrılmış proje önerilir; mevcut tablolarla çakışmayı kontrol edin.
5. Authentication / Users üzerinden ilk yönetici hesabını oluşturun. Hesabın UUID'sini kopyalayın.
6. Aşağıdaki bootstrap SQL'inde örnek UUID yerine bu UUID'yi yazarak SQL Editor'da çalıştırın. Parola SQL'e yazılmaz.

```sql
BEGIN;
INSERT INTO public.profiles (id, display_name)
VALUES ('AUTH_USERS_ICINDEKI_UUID', 'Kulüp Yöneticisi');
INSERT INTO public.user_roles (user_id, role)
VALUES ('AUTH_USERS_ICINDEKI_UUID', 'ADMIN');
COMMIT;
```

7. Antrenör hesaplarını da Auth Users üzerinden oluşturun. `profiles` kaydını ekleyip `user_roles` içinde `COACH` rolü verin. İlk sürümde Auth kullanıcı daveti/provisioning API'si yoktur; bu işlem yetkili Supabase panelinden yapılır. Sporculara giriş hesabı açılmaz.
8. Supabase Auth ayarlarında herkese açık kayıt olmayı kapatın; yalnızca davetli hesaplar kullanın. Auth hız limitlerini yapılandırın; üretimde yönetici hesapları için MFA politikası ayrıca tamamlanmalıdır. HTTPS kullanın.

Proje URL ve public anahtar, migration çalıştırmaya yetmez. Uzak veritabanı değişiklikleri SQL Editor veya yetkili CLI bağlantısıyla uygulanmalıdır. Yerel test sonucu uzak migration uygulandığı anlamına gelmez.

## API sözleşmesi

Tüm kulüp uçları Supabase oturum çerezi ister. POST/PATCH için aynı origin'e ait `Origin` ve `Content-Type: application/json` başlıkları gereklidir. Başarı yanıtı `{ data: [...] }`, hata yanıtı `{ error: "..." }` biçimindedir. JSON gövdesi en fazla 32 KiB olabilir. Mutasyonlar geçersiz alanları reddeder; SQL/PostgREST filtre ifadeleri kabul edilmez.

- POST `/api/auth/login`: `{ "email": "...", "password": "..." }`; oturum çerezini ayarlar.
- POST `/api/auth/logout`: oturumu kapatır; JSON başlığı ve aynı-origin gerekir.
- GET `/api/auth/me`: doğrulanmış kullanıcı kimliği ve roller.
- GET `/api/club/:resource?page=0`: en fazla 50 kayıt, RLS kapsamında; kayıt anahtarlarıyla eşitlik filtresi yapılabilir.
- POST `/api/club/:resource`: kayıt oluşturur.
- PATCH `/api/club/:resource?id=UUID`: tekil anahtarlı kaydı günceller. Birleşik anahtarda her iki URL parametresi zorunludur.
- GET `/api/club/reports?from=2026-11-01T00:00:00%2B03:00&until=2026-12-01T00:00:00%2B03:00`: yalnızca yönetici, en fazla 93 gün; bitiş hariçtir. Her ders için beklenen sporcu, girilen yoklama ve durum sayıları ile antrenör katılımı döner. `expected - recorded` eksik yoklamadır; yok sayılmaz. İptal dersleri yanıtta ayrı durumla bulunur; devam oranına katılmamalıdır.

Kaynaklar: `groups`, `group_terms`, `athletes`, `guardians`, `athlete_guardians`, `enrollments`, `coach_assignments`, `training_plans`, `schedule_rules`, `sessions`, `session_coaches`, `session_athletes`, `athlete_attendance`. Şemalar `src/lib/resources.ts` içindedir. Silme API'si yoktur; pasifleştirme, dönem kapatma ve ders iptali kullanılır.

### Bir ders hazırlama sırası

Yönetici: grup → dönem → sporcu → üyelik → antrenör dönem görevi → somut ders → ders antrenörü → ders sporcu listesi. Her çağrı ayrı transaction'dır; bunları birleştiren toplu ders oluşturma uç noktası henüz yoktur. Ders antrenörü ve listesi tamamlanmadan hazır sayılmamalıdır. Tekrarlayan program kuralları saklanır; otomatik ders üretim işi/cron henüz eklenmedi, somut dersler `sessions` üzerinden oluşturulur.

Antrenör kendi grubuna bağlı `training_plans` oluşturabilir. Genel plan yalnızca yöneticiye aittir. Ders zamanı ve görevlendirmesi yönetici tarafından tanımlanır. Yoklama durumları `PRESENT`, `ABSENT`, `EXCUSED`.

Yoklama örneği:

```json
{
  "session_id": "DERS_UUID",
  "athlete_id": "SPORCU_UUID",
  "status": "PRESENT"
}
```

Düzeltme: PATCH `/api/club/athlete_attendance?session_id=DERS_UUID&athlete_id=SPORCU_UUID` gövde `{ "status": "EXCUSED" }`. Antrenör yalnızca kendi girdiği yoklamayı günceller; yönetici tümüne erişebilir. Yazarı ve kayıt zamanı DB tarafından atanır.

Antrenör katılımını yönetici `session_coaches` kaydında `participation_status` ile doğrular: `UNCONFIRMED`, `ATTENDED`, `ABSENT`, `EXCUSED`. Doğrulayan ve zaman DB tarafından atanır. Sporcu yoklaması antrenör katılımını otomatik onaylamaz.

## Güvenlik ve veri kuralları

- Public tabloların tümünde RLS açık; anonim erişim kapalıdır.
- API service-role anahtarı kullanmaz; kullanıcının Supabase oturumu ile çalışır.
- Antrenör kendi derslerini ve tanımlı sporcularını görür; başka antrenörlerin yoklamalarını göremez. Veli iletişim kayıtları ilk sürümde yalnızca yöneticiye açıktır.
- Roller ve hesaplar genel kaynak API'sinden düzenlenemez. DB politikası yalnızca yöneticinin doğrudan yetkili istemciyle düzenlemesine izin verir.
- Aynı sporcu/ders için tek yoklama; ders listesinde olmayan sporcu için kayıt yok.
- Üyelik tarih aralıkları çakışamaz. Dönem içi tarih ve antrenör ders çakışması kontrolleri DB'de yapılır.
- Atanmış dersin zamanı doğrudan değiştirilemez; iptal edip yeni ders oluşturulur. İptal ders yeniden açılamaz.
- Başlamamış veya iptal derse yoklama girilemez.
- Denetim kayıtları sadece alan adları ve kayıt kimliklerini tutar; kişisel alan değerlerini ve mazeret metnini kopyalamaz. İstemci denetim kayıtlarını değiştiremez/silemez.
- Supabase service-role veya DB sahibi RLS'yi aşabilir; bunları tarayıcıya vermeyin.

## Doğrulama

```bash
npm test
npm run typecheck
npm run build
```

PGlite testleri gerçek PostgreSQL motorunda migration, roller, RLS ve veri bütünlüğünü çalıştırır. Test Auth şeması yalnızca yerel fixture'dır; Supabase Auth servisinin yerine geçmez. Supabase üzerinde gerçek oturum, PostgREST şema görünürlüğü ve canlı veri yazımı ayrıca doğrulanmalıdır. Eşzamanlı yarış testleri henüz ayrı bağlantılı PostgreSQL üzerinde çalıştırılmadı.

Yönetici paneli uygulanmıştır; gerçek hesapla oturum açılmış uçtan uca Supabase yazımı ayrıca doğrulanmalıdır. Antrenör paneline kullanıcı onayı olmadan geçilmez.


## Yönetici paneli (Aşama 3)

- `/login`: Supabase e-posta/parola girişi. Parolalar tarayıcı depolamasına kaydedilmez. Oturum sunucunun HttpOnly çerezleriyle tutulur.
- `/admin`: Yalnızca ADMIN rolüne sahip hesapların kullanabildiği istemci paneli; veriler ayrıca her API isteğinde ve PostgreSQL RLS ile korunur. Anonim kullanıcı girişe yönlendirilir, COACH rolündeki kullanıcıya erişim engeli gösterilir.
- Genel bakış: gerçek kayıt sayıları ve bugünkü dersler; ürün içinde örnek/demo veri bulunmaz.
- Gruplar ve dönemler: oluşturma, düzenleme, tarih değişikliği, kapatma/pasifleştirme.
- Sporcular: ad/soyad arama, oluşturma/düzenleme ve dönem üyeliği.
- Antrenörler: mevcut hesap dizini ve dönem/tarih bazlı görevlendirme. Yeni Auth hesabı oluşturma önceki aşamadaki Supabase paneli adımlarıyla yapılır.
- Ders takvimi: tüm antrenörlerin tarih sıralı ders listesi. Ders detayında antrenör atama, sporcu listesi, yönetici tarafından katılım doğrulama ve sporcu yoklaması.
- Antrenman programları: genel/gruba özel planlar ve haftalık saat kuralları. Otomatik ders üretimi hâlâ etkin değildir.
- Raporlar: en fazla 93 gün; eksik yoklamalar ve doğrulanmamış antrenör katılımı ayrı gösterilir. CSV çıktısı elektronik tablo formül enjeksiyonuna karşı korunur.
- Arayüz masaüstü ve 390px mobil genişlikte kontrol edildi. Dialoglar klavye/Escape ile kullanılabilir; formlar hata ve yüklenme durumlarını bildirir.

### Mevcut Supabase projesine gerekli düzeltme

001 migration zaten uygulanmışsa ilk kurulumu tekrar çalıştırmayın. Yalnızca `supabase/migrations/202611050002_history_edit_fix.sql` dosyasını SQL Editor'da çalıştırın. Bu, tarih düzenlemesindeki tabloya özel NEW/OLD alan hatasını giderir; tablo veya veri silmez. Kullanıcı bu düzeltmeden sonra tarih düzenlemesinin çalıştığını doğruladı.

### Tarayıcı testleri

```bash
npm run build
npm run test:browser
```

Testler sistem Chromium'u `/usr/bin/chromium` üzerinden kullanır. Başka sistemlerde `PLAYWRIGHT_CHROMIUM_EXECUTABLE` değişkenini kurulu Chromium yoluna ayarlayın. Test sunucusu 3030 portunda başlatılır ve kapanır. Kullanıcı/parola/rol içeren test verileri **yalnızca testlerde** bulunur; yetkili UI akışları mock API ile, anonim API reddi gerçek backend ile test edilir. Bu testler gerçek yönetici hesabıyla Supabase girişini veya gerçek kulüp verisi yazımını kanıtlamaz. Ekran görüntüleri `test-results/` içindedir ve Git'e alınmaz.

## Tanıtım sitesi ve içerik yönetimi

Ana sayfa `/`, kullanıcının seçtiği 6 numaralı yerleşim ve 5 numaralı mavi/beyaz/sarı renk sistemiyle uygulanmıştır. `/login` ve `/admin` korunmuştur. Fotoğraflar temsili olarak üretilmiştir; yönetici gerçek kulüp fotoğraflarıyla değiştirebilir. Başlangıç telefonu önceki sitenin herkese açık `tel:` bağlantısından alınmıştır; yayımlamadan önce doğrulayın. Ana başvuru düğmesi iletişim alanına, telefon düğmesi cihazın arama uygulamasına gider; bir başvuru kaydı oluşturulduğu iddia edilmez.

### Gerekli üçüncü migration

İlk iki migration uygulanmış projede yalnızca `supabase/migrations/202611050003_site_content.sql` dosyasını çalıştırın. Bu migration `site_content` tablosunu ve `site-media` public Storage bucket'ını oluşturur. İlk kurulum SQL'ini tekrar çalıştırmayın. Yeni bir projede migration'ların tümünü dosya adı sırasıyla uygulayın.

- `/admin` → **Site içeriği**: marka/menü, ana başlık/açıklamalar, düğme metinleri, üç fotoğraf ve alt metinleri, kulüp/antrenör açıklamaları, telefon ve alt bilgi değiştirilebilir.
- **Kaydet ve yayımla** kayıtları anında ana sayfanın sonraki isteğine yansıtır. Ayrı taslak/yayın geçmişi veya zamanlanmış yayın yoktur.
- Görsel yükleme PNG, JPEG, WebP ile sınırlıdır; sunucu dosya imzasını denetler, 5 MB sınırını akış okunurken uygular. SVG kabul edilmez. Her yükleme yeni UUID dosya adı alır; önbellek eski resmi korumaz.
- Yüklenen dosyalar public medyadır. Gizli öğrenci belgeleri veya özel kayıtlar bu alana yüklenmemelidir. Önceki görseller otomatik silinmez; Storage temizliği ayrıca yapılabilir.
- İçerik satırı public okunabilir, yalnızca aktif ADMIN güncelleyebilir. Antrenör içerik veya medya yazamaz. Sürüm kontrolü eşzamanlı düzenlemelerin birbirini ezmesini engeller (HTTP 409). Site, metinleri HTML olarak çalıştırmaz.
- Yeni medya yüklemek tek başına sayfadaki resmi değiştirmez; yeni adresin içerikte Kaydet ve yayımla ile kaydedilmesi gerekir.
- Migration uygulanmamışsa ana sayfa kod içindeki onaylanmış varsayılan içerikle görünür; yönetici editörü 503 kurulum hatası gösterir ve başarılı kayıt iddiasında bulunmaz.
- GET/PUT `/api/admin/content`: admin oturumu gerekir. PUT gövdesi `{ content: SiteContent, revision: number }`.
- POST `/api/admin/media`: admin oturumu, aynı Origin ve ham görsel gövdesi; `{url}` döner. Genel JSON body helper yerine sınırlı binary akış kullanır.

Kullanıcı 003 kurulumunu ve gerçek oturumla içerik kaydını doğruladı. Supabase RLS'yi veya doğrulamayı kapatmayın.

## Antrenör paneli (Aşama 4)

- Ortak `/login` ekranı ADMIN hesabını `/admin`, COACH hesabını `/coach` adresine yönlendirir. İki rol varsa yönetici paneli önceliklidir; COACH rolü olan yönetici doğrudan `/coach` adresini de açabilir.
- `/coach`: kendi ders listesi, sporcular, haftalık program ve antrenman planları. Genel kulüp planları salt okunur; antrenör geçerli görevlendirmesi olan gruplara plan ekler ve kendi planlarını düzenler.
- Ders detayı: Var / Yok / Mazeretli seçimi, isteğe bağlı not; sayfa başına 50 sporcu ve bir işlemde en fazla 100 seçim. Seçimler yalnızca Seçilenleri kaydet ile veritabanına gider. Tek kayıt reddedilirse tamamı geri alınır, seçimler ekranda korunur.
- Başlamamış/iptal dersler salt okunurdur. Antrenör kendi derse katılımını onaylayamaz; yönetici doğrular.
- Yeni RPC, ADMIN+COACH çift rolü olsa bile başka yazarın yoklamasını devralmaz. Yönetici tüm kayıtlarını ayrı yönetici uçlarından yönetmeye devam eder.
- Antrenör ekranı sadece kendi girdiği yoklamaları gösterir. Aynı derste başka yetkilinin kaydı varsa toplu işlem 403 dönebilir; yönetici üzerinden çözülür. Kaydı görünmeyen sporcu otomatik Yok sayılmaz.

### Dördüncü migration

Mevcut projede yalnızca `supabase/migrations/202611050004_coach_workflow.sql` uygulanmalıdır. İlk üç migration tekrar çalıştırılmaz. Bu migration toplu kayıt RPC'sini, yalnızca atanmış derslerin geçmiş/gelecek grup metadatası okuma politikalarını ve İstanbul gün sınırı düzeltmesini ekler. Sporcu/yoklama tablolarını silmez veya sıfırlamaz. Uygulanmamış projede toplu yoklama 503 kurulum hatası verir; yanlış başarı mesajı göstermez.

### Ayrı antrenör hesabı

İlk sürümde Auth kullanıcı oluşturma, Supabase Authentication / Users ekranından yapılır; parola sohbette paylaşılmaz. Yeni kullanıcının e-postasını ve görünen adını aşağıdaki SQL'de kendiniz doldurun. Bu işlem rol atamayı yalnızca yetkili SQL Editor oturumunda yapar, web ziyaretçisine açık değildir.

```sql
DO $$
DECLARE coach_user uuid;
BEGIN
 SELECT id INTO coach_user FROM auth.users
 WHERE lower(email)=lower('ANTRENOR_EPOSTASI');
 IF coach_user IS NULL THEN
  RAISE EXCEPTION 'Önce Authentication / Users içinde hesabı oluşturun.';
 END IF;
 INSERT INTO public.profiles(id,display_name)
 VALUES(coach_user,'ANTRENOR_ADI') ON CONFLICT(id) DO NOTHING;
 INSERT INTO public.user_roles(user_id,role)
 VALUES(coach_user,'COACH') ON CONFLICT(user_id,role) DO NOTHING;
END $$;
```

Ardından yönetici panelinde grubu/dönemi ve sporcuyu kaydedin. 005 kurulumundan sonra Ders oluştur formunda grubu, antrenörü ve sporcuları birlikte seçebilirsiniz. Eksik grup görevlendirmesi varsa açık onayınızla yalnızca ders günü için oluşturulur. Antrenör ayrı hesabıyla giriş yaptığında bu dersler görünür. Sadece hesap açmak bir ders veya gruba otomatik atama yapmaz.

### Test kapsamı

Yerel PGlite testleri gerçek PostgreSQL RLS/transaction kurallarını çalıştırır. UI tarayıcı testlerinde yetkili oturum/API mock kullanılır. `npm run test:browser -- --grep-invert 'public homepage'` yönetici ve antrenör akışlarını kapsar; kullanıcı tarafından düzenlenebilen canlı ana sayfa içerik testi bu koşudan bilerek hariç tutulur. Canlı antrenör hesabıyla yoklama/plan yazımı ayrıca doğrulanmalıdır.

## Sade paneller, profil ve sporcu onayları (005)

Mevcut projede **yalnızca** `supabase/migrations/202611050005_profiles_requests_lessons.sql` dosyasını SQL Editor’da bir kez çalıştırın. 001–004 daha önce uygulandı; tekrar çalıştırmayın. Bu ek kurulum mevcut hesapları, dersleri veya yoklamaları silmez. Uzak veritabanında 005 henüz uygulanmadı; public anahtarla DDL çalıştırılamaz.

- Antrenör menüsü üç bölüm: **Derslerim**, **Sporcu talepleri**, **Profilim**. Planlar ve haftalık saatler derslerin altında açılır. Geçmiş dersler de listede kalır.
- Profil: ad soyad, telefon, şehir, uzmanlık, açıklama ve fotoğraf. Giriş e-postası salt okunurdur. Ad değişikliği diğer personelin listelerine de yansır; rol/aktiflik değiştirilemez. Fotoğraflar ayrı **private** `coach-avatars` bucket’ında, kullanıcıya ait klasörde saklanır; 1 saatlik imzalı adresle gösterilir. 3 MB PNG/JPEG/WebP; kaydedilmeyen eski yüklemeler otomatik silinmez.
- Antrenör kendi grup/dersine **Sporcu talebi** gönderir. Beklerken aktif sporcu, dönem kaydı veya ders listesi oluşmaz. Başkasının talepleri görünmez; antrenör onay veremez.
- Yönetici: **Sporcular → Sporcu onayları**. Onay sırasında yeni sporcu oluşturabilir veya mevcut aktif sporcuya eşleştirebilir; onay tek transaction’da sporcu/dönem kaydını ve varsa seçili ders listesini tamamlar. Ret gerekçesi zorunludur. Aynı talebe ikinci karar 409 döner.
- Yönetici ana ekranı işlem kısayollarını ve bugünkü dersleri gösterir. Program/rapor menüleri açılır. **Ders oluştur** tek formda antrenör ve en fazla 200 kayıtlı sporcu seçer; grup görevlendirmesi yoksa yalnızca o gün için açık onay ister. Tüm kayıtlar atomiktir.
- API’ler: GET/PUT `/api/coach/profile`, POST `/api/coach/avatar`, GET/POST `/api/coach/athlete-requests`, GET/POST `/api/admin/athlete-requests`, POST `/api/admin/lessons`. Cookie oturumu, aktif rol, same-origin yazma kontrolü ve sunucu tarafı validasyon kullanılır; RLS ayrıca uygulanır.

Doğrulama: üretim derlemesi, 17 tarayıcı senaryosu ve 49 yerel test; PostgreSQL izinleri, özel fotoğraflar, kendi profilini düzenlerken yetki yükseltememe, onaysız sporcu izolasyonu, onay/ret, tekrar karar ve başarısız işlemde rollback. Yetkili tarayıcı senaryoları API mock kullanır; gerçek Supabase hesabıyla profil/talep işlemleri 005 uygulandıktan sonra ayrıca doğrulanmalıdır.

## Antrenör davet ve hesap yönetimi (006)

Yeni antrenör için rutin SQL veya Authentication / Users işlemi gerekmez. Yönetici **Antrenörler → Antrenör davet et** üzerinden ad/e-posta girer ve üretilen bağlantıyı kişiye paylaşır. Uygulama bağlantıyı kendiliğinden e-postalamaz; yeni kullanıcının e-posta doğrulaması Supabase Auth tarafından gönderilir. Antrenör kendi parolasını belirler; mevcut hesabı olan kişi davet ekranındaki **Zaten hesabım var** seçeneğini kullanır. Sonrasında ders ataması yönetici tarafından yapılır.

### Bir defalık etkinleştirme

1. Önceki kurulumları tekrarlamadan `supabase/migrations/202611050006_coach_invitations.sql` dosyasını SQL Editor’da bir kez çalıştırın. Bu ek kurulum mevcut hesapları/dersleri silmez, antrenör yetkilerini kaldırmaz. 005’ten bağımsızdır; profil ve sporcu talebi özellikleri için 005 yine gereklidir.
2. Supabase **Authentication → URL Configuration**: Site URL `https://alanyadenizaslanlari.netlify.app`; Redirect URLs listesine `https://alanyadenizaslanlari.netlify.app/**` ekleyin. Özel alan adına geçilirse üretim origin ve bu ayarlar birlikte güncellenmelidir. Yerelde doğrulama denenecekse ilgili localhost origin ayrı eklenir.
3. Supabase Email sağlayıcısında e-posta ile yeni kullanıcı kaydı etkin olmalı. **Confirm email** açık tutulmalıdır. Gerçek e-posta teslimi Auth/SMTP ayarlarına ve sağlayıcı gönderim limitlerine bağlıdır; sunucu 429 mesajını kullanıcıya gösterir.

### Davet ve yetki kuralları

- Sunucu 32 rastgele baytlık bağlantı anahtarı üretir; veritabanında yalnızca SHA-256 özeti tutulur. HTTP listeleme token özetini dahi vermez. Ham bağlantı oluşturulduğu anda gösterilir; kaybolursa yeni bağlantı oluşturulur.
- Davet 7 gün geçerli ve e-posta adresine bağlıdır. Yenileme aynı e-postanın eski bekleyen davetini iptal eder; yönetici ayrıca iptal edebilir. Kabul satır kilidiyle yapılır; aynı kişinin başarılı kabulünü tekrar etmesi çoğaltma yapmaz.
- Davet kabulü Auth oturumundaki gerçek `auth.users.email` ve `email_confirmed_at` değerlerini denetler. Gövdeden rol/e-posta ataması alınmaz; kullanıcı metadata’sına güvenilmez. Doğrulanmamış/yanlış e-posta, anonim, süresi dolmuş veya iptal davet profil/rol oluşturamaz.
- Profil ve yalnızca COACH rolü aynı DB transaction’ında oluşur. Mevcut aktif profilin adı korunur. Auth e-posta kaydı oluşturulup doğrulanmadan kalırsa kulüp profili/rolü oluşmaz; davet iptal edilse bile bu bekleyen Auth kaydı kulüp verilerine erişemez.
- Davet kabul eden kişinin `/api/auth/me` için henüz profili olmaması beklenir; kabul uçları doğrudan doğrulanmış Auth oturumunu kontrol eder. Diğer kulüp API’leri aktif profil kontrolünü korur.
- Mevcut antrenör adı ve aktifliği panelden düzenlenir. Pasifleştirme hesabı veya eski ders/yoklama kayıtlarını silmez; RLS ve API erişimini kapatır. ADMIN rolü de olan hesap bu ekrandan pasifleştirilemez.
- PKCE doğrulama kodu `/auth/callback` üzerinde değiştirilir. İzin verilen dönüş yolu yalnızca aynı sitenin `/invite/<token>` adresidir. Doğrulama bağlantısı aynı tarayıcıda açılmalıdır; başka tarayıcıda açılmışsa doğrulama sonrasında davet bağlantısından mevcut parola ile giriş yapılabilir. Davet sayfası no-store/no-referrer/noindex kullanır.
- Service-role veya secret anahtar kullanılmaz. Supabase’e doğrudan kayıt açılması tek başına kulüp rolü vermez.

Yeni uçlar: GET/POST/DELETE `/api/admin/coach-invitations`, PATCH `/api/admin/coaches`, GET `/api/invitations`, POST `/api/invitations/session`, POST `/api/invitations/accept`, GET `/auth/callback`, `/invite/[token]`. Yetkili yönetici işlemlerinde aktif ADMIN kontrolü; tüm yazmalarda aynı kaynak ve katı alan doğrulaması vardır.

Doğrulama: üretim derlemesi, 22 tarayıcı senaryosu ve 59 yerel test; PostgreSQL testleri doğrulanmış e-posta/rol sınırı, iptal/yenileme/süre aşımı, idempotent kabul, mevcut hesap, aktif/pasif ve yönetici hesabını korumayı kapsar. Tarayıcıdaki yetkili UI/Auth cevapları mock’tur; gerçek e-posta gönderimi ve gerçek davet kabulü uzak 006 kurulumu sonrasında ayrıca doğrulanmalıdır.

## Tek uygulama: ziyaretçi sitesi ve kulüp paneli

Kullanıcı son tercihinde mavi/sarı tasarımı ziyaretçilerin göreceği ana site olarak seçti. Hedef yapı, iki alan adını da bu Next.js uygulamasında (`alanyadenizaslanlari`) toplar:

- `https://alanyadenizaslanlarisk.com`: mavi/sarı ziyaretçi sitesi. İçerik, mevcut Supabase `site_content` kaydından okunur ve yönetici Site içeriği editörüyle güncellenir.
- `https://panel.alanyadenizaslanlarisk.com`: ana yol `/login` adresine yönlenir; yönetici ve antrenör ekranları aynı uygulamadadır.
- `silver-semifreddo-30119f` projesindeki krem Astro kopyası içerik/yayın yedeğidir. Seçilen ana tasarım değildir. Eski blog/başarı içeriklerinin tamamı bu yedekte korunur; bu değişiklik o içerikleri yeni tasarımda yeniden modellemez.

Portal bağlantıları açıkça panel originine; panelin Siteyi aç / Kulüp sitesine dön bağlantıları ziyaretçi originine gider. Public host üzerindeki login/admin/coach/invite/auth yolları panel originine yönlenir. Eski `/hakkimizda`, `/kadro`, `/iletisim`, `/programlar` bağlantıları yeni tek sayfanın ilgili bölümlerine gider.

Eski `alanyadenizaslanlari.netlify.app` hostu yol ve sorguyu koruyarak panel originine 308 yönlenir. Host koşulları localhost/deploy preview adreslerine uygulanmaz. Panel kök yönlendirmesi yalnızca panel hostunda çalışır; public kökte mavi/sarı sayfa gösterilir.

**Yayın ayarı:** `netlify.toml` içinde `APP_ORIGIN=https://panel.alanyadenizaslanlarisk.com` sabittir. Netlify'nin birincil domaini ana siteye değişse bile doğrulanmış yazma işlemleri yalnızca panel origininden kabul edilir. API için CORS veya ek güvenilir origin genişlemesi yapılmaz.

**Alan adı geçişi:** Ana domain ve `www` alias'ları `silver-semifreddo-30119f` projesinden bu projeye taşınır. Ana domain birincil yapılır; panel alias'ı bu projede kalır. Cloudflare'deki `www` CNAME hedefi `alanyadenizaslanlari.netlify.app` olmalıdır. `@` A kaydı ve `panel` CNAME kaydı aynı kalır.

**Supabase:** Authentication → URL Configuration içinde Site URL `https://panel.alanyadenizaslanlarisk.com`, Redirect URLs listesinde `https://panel.alanyadenizaslanlarisk.com/**` olmalıdır. Mevcut kullanıcılar/veriler korunur; farklı hostlarda oturum çerezleri ayrı olduğundan panel adresinde mevcut hesapla giriş yapılır.

Doğrulama: üretim derlemesi, 11 origin/içerik/validasyon testi, 12 yerel üretim HTTP kontrolü ve iki tarayıcı görünümü. Public kök, panel kök/giriş, giriş ve davet yönlendirmeleri, eski içerik bağlantıları, sorgu korunması ve portal origin yazma sınırı doğrulandı.

## Deneme dersi başvuru formu

Ana sayfadaki Deneme dersine başvur düğmesi `#basvuru` bölümündeki gerçek forma gider. Form ad, telefon, kendisi/çocuğu için başvuru, gerekiyorsa çocuk yaşı, ders tercihi, isteğe bağlı not ve başvuru amacıyla iletişim onayı alır. Kimlik numarası, doğum tarihi veya sağlık bilgisi istenmez.

Gönderim, kullanıcının eski sitesinde zaten kullanılan Web3Forms e-posta alıcı anahtarıyla yapılır (`NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY`, public form kimliği). Bu bir secret/service-role anahtarı değildir. Netlify build ortamında tanımlıdır. Başvurular bu aşamada Supabase’e sporcu veya kayıt olarak eklenmez; mevcut e-posta akışına iletilir.

İstemci alanları doğrular; boş onay/telefon/çocuk yaşı ile göndermez. Sağlayıcı HTTP başarılı yanıt **ve** `success:true` vermeden başarılı gönderim göstermez. Hatalarda/zaman aşımında kullanıcı girdileri korunur. Honeypot, gönderim sırasında kilit ve 20 saniyelik zaman aşımı vardır. Native form POST fallback’i kişisel bilgilerin URL sorgusuna yazılmasını engeller.

Doğrulama: payload validasyonu/çocuk yaşı/alan sınırları için 2 test; mobil tarayıcı senaryosunda CTA ile forma ulaşma, zorunlu alanlar, sağlayıcı reddi, ağ hatası, girdileri koruma ve kabul sonrası başarı test edilir. Web3Forms testte mock edilir; gerçek e-posta gönderilmez ve alıcıya teslim garantisi iddia edilmez.

### Public website pages and legacy content

The approved blue/yellow homepage links to real routes (`/hakkimizda`, `/programlar`, `/kadro`, `/iletisim`, `/basvuru`) rather than scroll anchors. Forty-six published Turkish/English pages from the previous Astro site are preserved in `src/data/public-pages.json`; original club photographs and video are namespaced under `public/legacy/`. Eight programme detail pages, coach biography, articles, achievements, parent guidance and legal pages remain accessible. This import contains published website content only, not private coach profiles.

`src/app/[...slug]/page.tsx` renders only registered public pages; unknown paths return 404. `PublicRichText` renders limited text formatting through React without raw HTML execution. Navigation and image protocols are validated. The public sitemap includes the registered routes. Existing portal/authentication host redirects remain in place.

Administrators can select a page under **Site içeriği → Diğer sayfalar** and edit its title, introduction, body and photograph URL. Existing JSONB content stores these overrides in `pageOverrides`; no database migration is required. **Orijinal içeriği kullan** restores the imported page after publishing. Editing the contact/programme body replaces its default information cards with the administrator's text. Telephone links use the current CMS telephone. Legacy schedules are presented as published facility information; current lesson availability is confirmed with the club.

Subtle reveal, image-hover and decorative water animations respect `prefers-reduced-motion`; content remains readable without JavaScript. The application form is now on `/basvuru` and retains its existing consent, validation and submission behavior.

### Turkish, English and Russian public website

The header pairs the existing club sea-lion emblem with the **DAS** abbreviation. Its compact language menu opens the equivalent page in Turkish (`/`), English (`/en`) or Russian (`/ru`) and keeps subsequent public navigation in the selected language. All 24 public subpages have English and Russian counterparts, including coach details, articles, programme details, contact, application and legal text. Internal links inside article content are localized as well. Pages render their translated content on the server with the corresponding HTML language and hreflang metadata; the public sitemap includes all three language versions.

Translations are bundled in `src/data/public-translations.json` and `src/data/public-ui-translations.json`; no translation service is contacted when a visitor opens the site. The initial translations were machine assisted and navigation, key marketing copy, programme names, form labels and consent text were edited. Programme facts, official names, photographs and link targets were preserved. New editorial content should be maintained in each language.

**Site içeriği → Ana sayfanın içerik dili** edits homepage text separately for each language through backward-compatible `localizedText` JSON content. The club name, images and telephone are shared. Other-page editing lists all localized routes. Form messages and consent are localized, while field codes and validation remain stable; submissions include `preferred_language` so the club can reply appropriately.

Federation references use the verified public triathlon club record, the Turkish Swimming Federation's official registration guidance and the Turkish Cycling Federation's official website/portal. Swimming and cycling membership registrations could not be verified in public directories; their portals require authentication. The user deferred providing registration identifiers. The general federation links are therefore labelled as official references, not as proof of the club's membership in those two federations.

### Additional administrator: denizaslanlari@gmail.com

Login, administrator and coach screens share `PortalBrand`, which displays the existing purple club emblem and DAS abbreviation.

This account has not been provisioned by application code. Create it through the authorized Supabase **Authentication → Users → Add user → Create new user** interface, choose its password there, and ensure email verification is complete. Passwords and Auth identities are never created or modified by SQL.

1. Run `supabase/operations/preview-denizaslanlari-admin.sql` in Supabase SQL Editor. This is read-only and reports the exact email match, verification, profile activity and existing ADMIN role.
2. **Permission-changing operation:** run `supabase/operations/grant-denizaslanlari-admin.sql` only for the authorized account. It creates a missing club profile and adds ADMIN inside a transaction. It fails for absent/ambiguous/unverified accounts and disabled profiles; existing profile names and roles remain intact. Re-running does not duplicate permissions.
3. Verify the returned row has the intended email, `is_active=true` and `role=ADMIN`, then sign in at the portal using the password set in Supabase.

These are manual operations, not application startup code or migrations. Existing RLS/authentication controls remain in force; no frontend email allowlist grants privileges. Local PostgreSQL fixture tests validate these cases but do not demonstrate that the live account or role exists.

### Login diagnostics

The password login endpoint distinguishes unconfirmed email (403), restricted accounts (403), invalid email/password (401), rate limits (429) and authentication-service failures (503). Only controlled messages reach the browser; passwords, raw Auth response bodies and account/session details are never logged or echoed. Email is trimmed/lowercased, while password characters are preserved exactly. Failed authentication never continues to the role lookup. This improves diagnosis without changing confirmation, RLS or role requirements.

### Account and permission management (007)

**Hesaplar ve yetkiler** is the administrator's account directory: search email/name, invite an administrator or coach, edit one/both roles, disable access and remove an account from the club. Removal deactivates the club profile, revokes roles and pending invitations, and hides the entry by default. **Kaldırılmış hesapları göster** allows an administrator to explicitly restore access. Auth identities and records referenced by lessons, attendance and assignments are retained. The historical coach directory keeps names available after a role is removed, while excluding that person from active coach selection.

One-time installation, with 001–006 already installed:

1. Run `supabase/operations/preview-account-management.sql` read-only. Confirm the baseline exists and at least one administrator is active.
2. **Schema/permission change:** run `supabase/migrations/202611070007_account_management.sql` once in the authorized Supabase SQL Editor. The file owns its PostgreSQL transaction and notifies PostgREST to reload its schema. No routine SQL/user provisioning is needed afterward.
3. Open **Hesaplar ve yetkiler**, invite a test email with the intended role, share the generated link, verify the recipient's email and check the resulting panel. Test role changes/removal using a secondary account while keeping the current administrator active.

| Change | Compatibility / impact |
| --- | --- |
| `coach_invitations.invite_role` with default COACH | Existing links retain their original role. Adding the constant default requires a brief table lock; no downtime claim is made. |
| Role-aware invitation RPCs | Existing coach API remains usable. During rollout, lookup falls back to 006 until 007 is applied. Acceptance chooses its destination from current DB roles. |
| Admin-only account directory | Limited/paginated fields from Auth and club profiles; no passwords, hashes or session tokens. Anon/coach callers are rejected. |
| Role/profile mutation guards | Transaction-level advisory locking serializes permission writes. Current and last active administrator access is protected through RPC and direct authenticated role/profile updates. |
| Access removal | Retains Auth and historical records, revokes pending links for the removed account and links issued by that account, and audits deleted role rows. This is club access removal, not permanent Auth deletion. |

New API: GET/PATCH/DELETE `/api/admin/accounts`; GET/POST/DELETE `/api/admin/account-invitations`. All mutations require the portal origin, strict whitelisted JSON and an active ADMIN. A role chosen in signup metadata cannot grant access: the invitation's stored role, matching verified email, active issuer and token status govern acceptance. Previously accepted links cannot restore roles that were subsequently removed. A stale demoted administrator cannot call management RPCs.

Before 007, the new section shows an actionable setup notice; existing login, public pages, coach directory and old invitation flow remain available. Migration failure rolls back the whole file. After a successful install, prefer a forward fix and retain the role column/guards; restoring a 006 accept function while ADMIN invitations are pending would change their meaning. Revoke pending invitations before any planned schema rollback. The authorized Supabase owner remains available for emergency account recovery; no service credential is introduced into the app.

Validation uses real PostgreSQL/PGlite role checks and local fixtures, plus mocked browser account flows. It does not prove that 007 has been applied to the remote database or that an actual invitation email was delivered. Invitation URLs are shared manually; verification mail still uses the project's existing Supabase Auth configuration.
