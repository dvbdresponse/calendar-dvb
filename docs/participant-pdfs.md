# Participant PDFs

Each meeting supports one optional PDF, up to 2 MiB (2,097,152 bytes).

## Enable on an existing Supabase project

1. If PDF attachments are not yet enabled, run `supabase/migrations/202610280001_participant_pdfs.sql` in Supabase SQL Editor.
2. Run `supabase/migrations/202610290001_public_participant_pdfs.sql` to enable guest reads for files attached to publicly visible events. If your event table has a custom name, adjust `public.events` in both scripts to match it. The app's setup SQL includes both migrations and handles the configured table name.
3. Sign in to the calendar and attach a PDF while creating or editing a meeting.

The default-table migration is also saved in `supabase/migrations/202610280001_participant_pdfs.sql`. New installations include it in the full schema shown by the app. The incremental script adds a nullable `participant_pdf_path` column and a private `meeting-participants` bucket; it does not replace groups, meetings or existing calendar RLS policies.

## Storage and access

- File bytes live in Storage. The event row contains only an opaque path, not the participant names or the original filename. Downloads use the filename `รายชื่อผู้เข้าร่วมประชุม.pdf`.
- The bucket enforces PDF MIME type and a 2 MiB size limit. The client also checks extension, MIME type, non-empty size and the `%PDF-` file header. This is basic file validation, not malware scanning.
- Guests can read files referenced by events visible to them under the existing event RLS policies. Unreferenced uploads remain unavailable to guests. The bucket stays private. Signed links expire after 10 minutes; anyone given one can access it until it expires. Reopening the viewer obtains a fresh link.
- Authenticated staff can remove files, matching the app's existing shared calendar editing permissions. Uploads must be placed under the uploader's user ID.
- Replacing or removing an attachment only removes the old file after the event saves successfully. Failed event saves attempt to remove the newly uploaded file. Deleting a meeting also removes its file. Cleanup failures are reported and may need manual cleanup in Storage.
- Duplicating a meeting does not copy its participant PDF, so the new meeting needs its own list.
- PDFs load only when someone clicks to open or download them.

## Mobile and LINE

The viewer renders PDF pages with Mozilla PDF.js inside the calendar, so it does not need native PDF support or a popup. It provides page navigation, zoom, loading/error feedback, retry, download and an external-browser link. PDF.js workers, fonts, CMaps and image decoders are served by this app, without passing files to a third-party viewer. Only one page is rendered at a time; canvas resolution is capped for mobile memory use.

In LINE, both attachment actions open the reader first. Its download link is a normal user-clicked link. If LINE still blocks downloads, use “เปิดในเบราว์เซอร์” (with LINE's `openExternalBrowser=1` flag) or LINE's menu to open Safari/Chrome. Local demo blob URLs cannot be opened in another browser, so that external action is available only for hosted files.

The reader exposes embedded PDF text for screen readers. Scanned image-only PDFs still require OCR in the source file. Password-protected documents can be downloaded for opening in a PDF app.

After deploying, verify a real attachment while signed out, plus opening/downloading on Android and iOS LINE. A frontend deployment alone cannot change existing Supabase Storage policies; the guest-read migration must also be applied.

## Local demo

File bytes are saved in IndexedDB; event data and the opaque file path stay in localStorage. Reloading preserves attachments in the same browser, subject to browser storage availability. Clearing site data removes the demo files. They are not synced between browsers and are not migrated automatically when connecting Supabase.
