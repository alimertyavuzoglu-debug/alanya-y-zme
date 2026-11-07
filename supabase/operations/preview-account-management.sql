-- READ ONLY: required baseline and active administrator count before 007.
SELECT to_regclass('public.profiles') IS NOT NULL AS profiles_ready,
 to_regclass('public.user_roles') IS NOT NULL AS roles_ready,
 to_regclass('public.coach_invitations') IS NOT NULL AS invitations_ready,
 EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public'
  AND table_name='coach_invitations' AND column_name='invite_role') AS account_management_already_installed;
SELECT count(*) AS active_administrators FROM public.user_roles r
 JOIN public.profiles p ON p.id=r.user_id WHERE r.role='ADMIN' AND p.is_active;
-- Expect baseline=true, active_administrators>=1. Run 007 only once.
