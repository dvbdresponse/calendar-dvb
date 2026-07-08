# ALC Calendar

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

1. Open the app and click database settings.
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

## LINE Daily Digest Notifications

A Supabase Edge Function can send a daily summary of the day's events to a LINE group each morning. See [docs/line-notifications.md](docs/line-notifications.md) for setup — this is optional and lives entirely in Supabase (secrets + a scheduled function), no frontend `.env` changes needed.

## Checks

```bash
npm run lint
npm run build
npm audit --omit=dev
```
