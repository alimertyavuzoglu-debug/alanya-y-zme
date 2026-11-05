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

001 migration zaten uygulanmışsa ilk kurulumu tekrar çalıştırmayın. Yalnızca `supabase/migrations/202611050002_history_edit_fix.sql` dosyasını SQL Editor'da çalıştırın. Bu, tarih düzenlemesindeki tabloya özel NEW/OLD alan hatasını giderir; tablo veya veri silmez. Uzak projeye bu düzeltmenin uygulandığı henüz doğrulanmadı.

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

Uzak Supabase üzerinde 003 migration ve gerçek oturumla içerik kaydı/yüklemesi henüz doğrulanmadı; yerel DB ve tarayıcı testleri bu işlemin yerine geçmez. Supabase RLS'yi veya doğrulamayı kapatmayın.

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

Ardından yönetici panelinde grubu/dönemi ve sporcuyu kaydedin, antrenörü döneme ve somut derse atayın, dersin sporcu listesini oluşturun. Antrenör ayrı hesabıyla giriş yaptığında bu dersler görünür. Sadece hesap açmak bir ders veya gruba otomatik atama yapmaz.

### Test kapsamı

Yerel PGlite testleri gerçek PostgreSQL RLS/transaction kurallarını çalıştırır. UI tarayıcı testlerinde yetkili oturum/API mock kullanılır. `npm run test:browser -- --grep-invert 'public homepage'` yönetici ve antrenör akışlarını kapsar; kullanıcı tarafından düzenlenebilen canlı ana sayfa içerik testi bu koşudan bilerek hariç tutulur. Canlı antrenör hesabıyla yoklama/plan yazımı ayrıca doğrulanmalıdır.
