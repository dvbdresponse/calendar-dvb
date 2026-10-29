-- Let guests read only PDFs referenced by events they can already see.
-- The bucket stays private; uploads and deletes still require authentication.
BEGIN;

DROP POLICY IF EXISTS "Public read referenced participant PDFs" ON storage.objects;
CREATE POLICY "Public read referenced participant PDFs" ON storage.objects
  FOR SELECT TO anon
  USING (
    bucket_id = 'meeting-participants'
    AND EXISTS (
      SELECT 1 FROM public.events AS event
      WHERE event.participant_pdf_path = storage.objects.name
    )
  );

COMMIT;
NOTIFY pgrst, 'reload schema';
