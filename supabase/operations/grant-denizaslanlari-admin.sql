-- YETKİ DEĞİŞİKLİĞİ: Yalnızca denizaslanlari@gmail.com hesabına ADMIN rolü ekler.
-- Önce preview-denizaslanlari-admin.sql ile hedefi kontrol edin.
-- Supabase SQL Editor'da çalıştırılır. Auth kullanıcısı veya parola oluşturmaz.
BEGIN;
DO $grant$
DECLARE
 target_id uuid;
 verified_at timestamptz;
 matches integer;
BEGIN
 SELECT count(*) INTO matches FROM auth.users
 WHERE lower(email)='denizaslanlari@gmail.com';
 IF matches<>1 THEN
  RAISE EXCEPTION 'Tek hesap bulunmali. Once Authentication > Users ekraninda denizaslanlari@gmail.com hesabini olusturun.';
 END IF;
 SELECT id,email_confirmed_at INTO STRICT target_id,verified_at
 FROM auth.users WHERE lower(email)='denizaslanlari@gmail.com'
 FOR UPDATE;
 IF verified_at IS NULL THEN
  RAISE EXCEPTION 'E-posta henuz dogrulanmamis. Once hedef hesabin e-posta dogrulamasini tamamlayin.';
 END IF;
 IF EXISTS(SELECT 1 FROM public.profiles WHERE id=target_id AND NOT is_active) THEN
  RAISE EXCEPTION 'Hedef hesap pasif. Yetki vermeden once pasif hesap durumunu yoneticinizle kontrol edin.';
 END IF;
 INSERT INTO public.profiles(id,display_name)
 VALUES(target_id,'Deniz Aslanları Yönetimi') ON CONFLICT(id) DO NOTHING;
 -- Profil varsa adını ve diğer bilgilerini korur; diğer roller de korunur.
 INSERT INTO public.user_roles(user_id,role)
 VALUES(target_id,'ADMIN') ON CONFLICT(user_id,role) DO NOTHING;
END $grant$;
SELECT u.email,p.is_active,r.role
FROM auth.users u
JOIN public.profiles p ON p.id=u.id
JOIN public.user_roles r ON r.user_id=u.id
WHERE lower(u.email)='denizaslanlari@gmail.com' AND r.role='ADMIN';
COMMIT;
