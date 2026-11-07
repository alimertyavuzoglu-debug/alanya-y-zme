-- SALT OKUNUR: Supabase SQL Editor üzerinden çalıştırın.
-- Sadece hedef e-postayı, eşleşme sayısını ve mevcut yönetici durumunu gösterir.
WITH target AS (
 SELECT id, email, email_confirmed_at
 FROM auth.users
 WHERE lower(email) = 'denizaslanlari@gmail.com'
)
SELECT t.id, t.email, t.email_confirmed_at IS NOT NULL AS email_verified,
 p.display_name, p.is_active,
 EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=t.id AND r.role='ADMIN') AS is_admin,
 count(*) OVER () AS matching_accounts
FROM target t
LEFT JOIN public.profiles p ON p.id=t.id;
-- Sonuç boşsa önce Authentication > Users > Add user > Create new user.
-- Devam koşulları: tek eşleşme, doğrulanmış e-posta, mevcut profil varsa aktif olması.
