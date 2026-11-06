# Ana siteyi tek Netlify hesabına alma

Hedef: Yönetim panelinin bulunduğu **Alanya Triatlon & Yüzme** Netlify hesabı. Ana site ve yönetim paneli bu hesapta ayrı projeler olarak çalışacak. Supabase veritabanı ve hesaplar korunur.

## Hazır paketler

- `ana-site-tasima.zip`: Netlify manuel yayınına hazır; ZIP kökünde index.html bulunur. Node kurulumu/derleme gerektirmez.
- `ana-site-orijinal-yedek.zip`: değişiklik öncesi yayımdaki sitenin kopyası.

Bu paketler halka açık yayımlanmış **statik çıktıdır**; özgün Astro `src`/`scripts` kaynaklarının veya Netlify hesap bilgilerinin dışa aktarımı değildir. Kaynak proje kullanıcının masaüstünde durur.

Yeni pakette Türkçe/İngilizce menülere Kulüp Paneli bağlantısı eklendi; mevcut hatalı göreli Instagram alt bilgi bağlantısı tam adrese düzeltildi. İçerik, görseller, kanonik adresler, sitemap, Google doğrulama etiketi ve ön kayıt formu korunur. Netlify güvenlik/önbellek başlıkları manuel dağıtıma uygun `_headers` dosyasına aktarıldı. Panel bağlantısı DNS taşınana kadar çalışan `https://alanyadenizaslanlari.netlify.app/login` adresine gider.

## İlk uygulama

1. Yeni/panel Netlify hesabında Projects → Add new project → Deploy manually.
2. `ana-site-tasima.zip` paketini yükleyin (veya ZIP’i açıp index.html içeren klasörü sürükleyin).
3. Verilen yeni `.netlify.app` adresinde ana siteyi kontrol edin. **Mevcut panel projesine bu statik ZIP yüklenmez.**

## DNS geçişi — henüz uygulanmadı

Eski takımda Netlify DNS sahipliği bulunduğu için doğrudan yeni takıma alan adı eklemek engelleniyor. Aktif sitenin DNS’i, yeni yayın doğrulanmadan değiştirilmez.

DNS yönetimini alan adının kayıtlı olduğu Natro’ya alarak tek Netlify hesabındaki iki yayına yönlendirmek mümkündür. Uygulamadan önce eski Netlify DNS bölgesindeki tüm kayıtlar (MX/TXT ve alt alan adları dahil) görüntülenip yedeklenmeli; yeni Natro DNS bölgesi bu kayıtlarla hazırlanmalı. Genel DNS sorguları tam bölge envanteri değildir. Yalnızca ana alan adında MX/TXT görülmediği, diğer adlarda kayıt bulunmadığını kanıtlamaz.

Natro yetkili sunucuları ve yeni ana sitenin `.netlify.app` adresi henüz alınmadığından geçişi uygulayacak değerler tamamlanmış değildir. DNS/alan adı silme veya nameserver değişikliği yapılmadı.

Olası geçiş sırası: önce Natro DNS bölgesini mevcut kayıtlarla hazırlamak; nameserver geçişini yapıp yayılımı kontrol etmek; ardından eski Netlify alan adı/bölge sahipliğini serbest bırakıp yeni hesapta ana site + panel alan adlarını tanımlamak ve HTTPS’i doğrulamak. Eski DNS bölgesi, önbellekteki eski delegasyonlar için gerekli olabileceğinden erken silinmez. Sonrasında Supabase Site URL/Redirect URL ayarları ve kalıcı panel bağlantısı güncellenir. DNS/HTTPS geçişinde kesintisizlik garantisi verilmez; gerçek kayıtlar görülerek adımlar kesinleştirilir.

## Doğrulama

- 50 HTML dosyası, 2.445 yerel referans; eksik yerel dosya yok.
- Tarayıcıda ana sayfa, İngilizce sayfa, kadro, başarılar, blog ve iletişim HTTP 200; JS hatası ve yerel 404 yok.
- 1440, 1280, 1024, 768, 390, 320 px genişlikte taşma yok; mobil ve masaüstünde panel bağlantısı mevcut.
- Gerçek ön kayıt formu gönderilmedi; dışarıya e-posta/WhatsApp mesajı gönderilmedi.
- Netlify yeni hesaba gerçek yükleme, DNS ve HTTPS doğrulaması bekliyor.
