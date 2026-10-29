-- Add private participant PDFs without changing existing calendar data or policies.
BEGIN;

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS participant_pdf_path TEXT;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('meeting-participants', 'meeting-participants', false, 2097152, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Staff read participant PDFs" ON storage.objects;
CREATE POLICY "Staff read participant PDFs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'meeting-participants');

DROP POLICY IF EXISTS "Staff upload participant PDFs" ON storage.objects;
CREATE POLICY "Staff upload participant PDFs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'meeting-participants'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND lower(storage.extension(name)) = 'pdf'
  );

-- Calendar editing is shared between authenticated staff in this app.
DROP POLICY IF EXISTS "Staff delete participant PDFs" ON storage.objects;
CREATE POLICY "Staff delete participant PDFs" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'meeting-participants');

COMMIT;
NOTIFY pgrst, 'reload schema';
