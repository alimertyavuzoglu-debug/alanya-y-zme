# Yeni Netlify sitesi — kurulum

Uygulama GitHub `alimertyavuzoglu-debug/alanya-y-zme` deposunun **main** dalındadır. `design-preview-20261105` dalı yalnızca görsel/SQL paylaşımı içindir ve uygulama yayını için seçilmemelidir. Bağlı GitHub uygulaması depo varsayılan dalını değiştirmeye yetkili değil (HTTP 403); Netlify import ekranında main'i açıkça seçin.

1. https://app.netlify.com/ üzerinden hesabınıza girin; gerekirse yeni hesap oluşturun.
2. Yeni proje oluşturup GitHub'dan mevcut projeyi içe aktarmayı seçin. Gerekirse GitHub uygulamasına yalnızca bu depo için erişim verin.
3. Depo: alimertyavuzoglu-debug/alanya-y-zme. Branch / production branch: **main**.
4. Base directory: boş / depo kökü. Build command: `npm run build`. Publish directory: `.next`. Node sürümü `netlify.toml` içinde 22'dir. Resmi Next.js/OpenNext adaptörü netlify.toml içinde açıkça etkinleştirilmiştir ve package-lock.json ile 5.16.6 sürümüne sabitlenmiştir. Düz statik dosya yüklemesi veya SPA redirect kuralı kullanmayın; API route'ları gerekir.
5. İlk deploy'dan önce, build ve functions/runtime için ortam değişkenlerini ekleyin:
   - NEXT_PUBLIC_SUPABASE_URL: https://mdgbjipphbakayyhnjjc.supabase.co
   - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: Supabase Settings/API Keys içindeki publishable key (sb_publishable_ ile başlar; eski projelerde anon key).
   Service-role, sb_secret veya veritabanı parolası kullanmayın.
6. Deploy'u başlatın. Oluşan HTTPS `...netlify.app` adresini sohbette paylaşın.

## Origin / alan adı

JSON mutasyonları ve medya yüklemesi ortak origin kontrolünü kullanır. Netlify'de production için platformun `URL`, önizleme için `DEPLOY_PRIME_URL` değişkeni kullanılır. Netlify dışında yerel istek Host/protokolü kullanılır. Özel bir canonical origin gerekiyorsa APP_ORIGIN ile açıkça ayarlanabilir; bu ayarı production kapsamıyla sınırlayın, deploy-preview adreslerini engellemeyin.

Son adres belirlendiğinde Supabase Authentication / URL Configuration / Site URL değerini de HTTPS site adresine ayarlayın. Şu anki şifreyle giriş akışında callback gerekmese de gelecekteki e-posta/reset akışları için önemlidir. Herkese açık kullanıcı kaydı kapalı tutulmalıdır.

## Yayın sonrası doğrulama

- `/`: yeni ana sayfa, gerçek kayıtlı site içeriği.
- `/login`: yönetici hesabıyla giriş. Parola sohbetten istenmez.
- `/admin`: yönetici rolüyle panel. Anonim istekler ve COACH rolü yetkili admin API'lerinden reddedilmeli.
- Site içeriği: kısa bir metin değişikliği → Kaydet ve yayımla → yeni sekmede ana sayfada doğrulama → gerekirse geri alma.
- Görsel: 5 MB altı PNG/JPEG/WebP yükleme → Kaydet ve yayımla → ana sayfada doğrulama.
- Çıkış, yenileme ve tekrar giriş; hata durumunda Netlify deploy log'larından gizli değer içermeyen hata satırları.

Yerel testler uzaktaki gerçek oturum ve medya yazımı yerine geçmez. Bu kontroller yayın adresi ve kullanıcı etkileşimi hazır olduğunda tamamlanır.


## Üretim dalını değiştirdikten sonra

Güncel arayüz yolu: Project configuration → Developer settings → Continuous deployment → Branches and deploy contexts → Configure. Production branch `main` olmalı ve Save ile kaydedilmelidir. Dal değişikliği önceki yayını tek başına değiştirmeyebilir; Deploys → Trigger deploy ile veya main dalına yeni push ile yeni build başlatın.

Doğru yayının işaretleri: ana sayfada çalışan tanıtım sitesi, `/login` HTTP 200 ve anonim `/api/auth/me` JSON HTTP 401. “Deniz Aslanları — Tasarım Seçimi” başlığı ve `/login` HTTP 404, eski statik galerinin hâlâ yayında olduğunu gösterir. Bu durumda Deploys ekranında yeni build'in dalını, commit'ini, durumunu ve hata log'unu inceleyin.


## Statik Next.js çıktısı / 404 teşhisi

Bu proje ilk kez tasarım galerisi dalından oluşturulduğundan otomatik framework algısı statik kaldı. Ana sayfa ve /login 404 iken kökte /BUILD_ID dosyasının 200 dönmesi, .next klasörünün sunucu adaptörü olmadan dosya olarak yayımlandığını doğruladı. Düzeltme: netlify.toml içindeki [[plugins]] @netlify/plugin-nextjs ve sabitlenmiş resmi paket. Yeni deploy build log'unda bu adaptörün çalışması ve Netlify Functions paketlemesi görülmelidir. Plugin'i kaldırmayın, publish alanına bir SPA redirect eklemeyin.

## Public Supabase build değerleri

İlk Next.js yayını API'de 503 SUPABASE_NOT_CONFIGURED döndürdü. Projenin public URL ve publishable key değerleri artık netlify.toml build.environment içinde tanımlıdır; bu değerler public istemciler için tasarlanmıştır. Gizli/service-role anahtarı değildir. NEXT_PUBLIC değişkenleri Next.js derlemesine gömüldüğünden değişikliklerinde yeniden deploy gerekir. Gerçek gizli anahtarlar bu dosyaya yazılmamalıdır. Proje veya publishable key değişirse bu iki build değeri de güncellenmelidir.
