# Yeni Netlify sitesi — kurulum

Uygulama GitHub `alimertyavuzoglu-debug/alanya-y-zme` deposunun **main** dalındadır. `design-preview-20261105` dalı yalnızca görsel/SQL paylaşımı içindir ve uygulama yayını için seçilmemelidir. Bağlı GitHub uygulaması depo varsayılan dalını değiştirmeye yetkili değil (HTTP 403); Netlify import ekranında main'i açıkça seçin.

1. https://app.netlify.com/ üzerinden hesabınıza girin; gerekirse yeni hesap oluşturun.
2. Yeni proje oluşturup GitHub'dan mevcut projeyi içe aktarmayı seçin. Gerekirse GitHub uygulamasına yalnızca bu depo için erişim verin.
3. Depo: alimertyavuzoglu-debug/alanya-y-zme. Branch / production branch: **main**.
4. Base directory: boş / depo kökü. Build command: `npm run build`. Publish directory: `.next`. Node sürümü `netlify.toml` içinde 22'dir. Netlify Next.js/OpenNext runtime'ını otomatik algılar. Düz statik dosya yüklemesi veya SPA redirect kuralı kullanmayın; API route'ları gerekir.
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
