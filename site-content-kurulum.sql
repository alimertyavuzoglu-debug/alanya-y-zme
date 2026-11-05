-- Yalnizca 001 ve 002 kurulumlari tamamlanmis proje icin.
-- Bir kez calistirin. Mevcut kulup kayitlarini silmez.
BEGIN;
CREATE TABLE public.site_content (
 key text PRIMARY KEY CHECK(key='homepage'),
 content jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(content)='object'),
 revision integer NOT NULL DEFAULT 0,
 updated_at timestamptz NOT NULL DEFAULT now(),
 updated_by uuid REFERENCES public.profiles(id)
);
INSERT INTO public.site_content(key) VALUES ('homepage');
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.site_content FROM anon,authenticated;
GRANT SELECT(key,content,revision) ON public.site_content TO anon,authenticated;
GRANT UPDATE(content) ON public.site_content TO authenticated;
CREATE POLICY content_read ON public.site_content FOR SELECT TO anon,authenticated USING(true);
CREATE POLICY content_admin_update ON public.site_content FOR UPDATE TO authenticated
 USING(private.has_role('ADMIN')) WITH CHECK(private.has_role('ADMIN'));
CREATE FUNCTION private.stamp_site_content() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 new.revision:=old.revision+1;
 new.updated_at:=now();new.updated_by:=auth.uid();
 INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_key,changed_fields)
 VALUES(auth.uid(),'UPDATE','site_content',jsonb_build_object('key',new.key),ARRAY['content']);
 RETURN new;
END $$;
REVOKE ALL ON FUNCTION private.stamp_site_content() FROM public,anon,authenticated;
CREATE TRIGGER stamp_site_content BEFORE UPDATE ON public.site_content
 FOR EACH ROW EXECUTE FUNCTION private.stamp_site_content();
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('site-media','site-media',true,5242880,ARRAY['image/png','image/jpeg','image/webp']);
CREATE POLICY site_media_admin_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK(bucket_id='site-media' AND private.has_role('ADMIN'));
CREATE POLICY site_media_admin_update ON storage.objects FOR UPDATE TO authenticated
USING(bucket_id='site-media' AND private.has_role('ADMIN'))
WITH CHECK(bucket_id='site-media' AND private.has_role('ADMIN'));
CREATE POLICY site_media_admin_delete ON storage.objects FOR DELETE TO authenticated
USING(bucket_id='site-media' AND private.has_role('ADMIN'));

COMMIT;
