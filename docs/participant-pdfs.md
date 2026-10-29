# Participant PDFs

Each meeting supports one optional PDF, up to 2 MiB (2,097,152 bytes).

## Enable on an existing Supabase project

1. Open `supabase/migrations/202610280001_participant_pdfs.sql` in this repository. If your event table has a custom name, adjust the `public.events` references to match it.
2. Run the script in Supabase SQL Editor once.
3. Sign in to the calendar and attach a PDF while creating or editing a meeting.

The default-table migration is also saved in `supabase/migrations/202610280001_participant_pdfs.sql`. New installations include it in the full schema shown by the app. The incremental script adds a nullable `participant_pdf_path` column and a private `meeting-participants` bucket; it does not replace groups, meetings or existing calendar RLS policies.

## Storage and access

- File bytes live in Storage. The event row contains only an opaque path, not the participant names or the original filename. Downloads use the filename `รายชื่อผู้เข้าร่วมประชุม.pdf`.
- The bucket enforces PDF MIME type and a 2 MiB size limit. The client also checks extension, MIME type, non-empty size and the `%PDF-` file header. This is basic file validation, not malware scanning.
- Only authenticated users can read files or create signed links. Signed links expire after 60 seconds; anyone given one can access it until it expires.
- Authenticated staff can remove files, matching the app's existing shared calendar editing permissions. Uploads must be placed under the uploader's user ID.
- Replacing or removing an attachment only removes the old file after the event saves successfully. Failed event saves attempt to remove the newly uploaded file. Deleting a meeting also removes its file. Cleanup failures are reported and may need manual cleanup in Storage.
- Duplicating a meeting does not copy its participant PDF, so the new meeting needs its own list.
- PDFs load only when someone clicks to open or download them.

## Local demo

File bytes are saved in IndexedDB; event data and the opaque file path stay in localStorage. Reloading preserves attachments in the same browser, subject to browser storage availability. Clearing site data removes the demo files. They are not synced between browsers and are not migrated automatically when connecting Supabase.
