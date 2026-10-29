# ปฏิทิน กองโรคติดต่อนำโดยแมลง

React + Vite calendar app for office meeting schedules. The app supports two modes:

- Local demo mode: shows browser sample data for preview.
- Supabase mode: reads public calendar data from Supabase and requires Supabase Auth for create, update, delete, and group management.

## Run Locally

1. Install dependencies:

   ```bash
   npm ci
   ```

2. Optional: create `.env.local` from `.env.example` and set:

   ```bash
   VITE_SUPABASE_URL="https://your-project.supabase.co"
   VITE_SUPABASE_ANON_KEY="your-public-anon-key"
   VITE_SUPABASE_EVENTS_TABLE="events"
   ```

3. Start the dev server:

   ```bash
   npm run dev
   ```

## Supabase Setup

1. Before configuring Supabase, open the local demo and click **ตั้งค่า Supabase** in the setup notice.
2. Copy the SQL schema from the Supabase setup modal.
3. Run it in Supabase SQL Editor.
4. Create users in Supabase Authentication.
5. Optional: add rows in `public.profiles` for better display names.

Example profile row:

```sql
INSERT INTO public.profiles (id, email, display_name, role)
VALUES ('USER_UUID_FROM_AUTH_USERS', 'user@example.go.th', 'เจ้าหน้าที่ ALC', 'officer');
```

The SQL enables RLS. Calendar events and groups are publicly readable. Creating, updating, deleting, and managing groups require a signed-in Supabase Auth user.

## Participant PDF Attachments

Meetings support one PDF participant list up to 2 MiB (2,097,152 bytes). Everyone can view or download PDFs attached to public events without signing in. Uploads and deletion require authentication. Files remain in a private Supabase bucket with signed links that expire after 10 minutes. Existing projects must apply the [PDF setup](supabase/migrations/202610280001_participant_pdfs.sql) and [guest read migration](supabase/migrations/202610290001_public_participant_pdfs.sql). The built-in PDF.js reader works without a browser PDF plugin or popup, including mobile webviews such as LINE. Local demo attachments use IndexedDB in the current browser. See [setup and behavior](docs/participant-pdfs.md).

## LINE Daily Digest Notifications

A Supabase Edge Function can send a daily summary of the day's events to a LINE group each morning. See [docs/line-notifications.md](docs/line-notifications.md) for setup — this is optional and lives entirely in Supabase (secrets + a scheduled function), no frontend `.env` changes needed.

## Header Icon

The header uses the [Bee icon by Lordicon](https://lordicon.com/icons/wired/lineal/1148-bee), hosted locally in `src/assets/lordicon/`. The original Lottie animation is 60 fps and plays with `@lordicon/element`, which respects reduced motion. A local SVG appears while the player loads or if loading fails. The footer includes the [required free-license attribution](https://lordicon.com/docs/license/attribution).

## Checks

```bash
npm run lint
npm run build
npm audit --omit=dev
```
