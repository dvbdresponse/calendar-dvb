# Government Meeting Calendar

React + Vite calendar app for office meeting schedules. The app supports two modes:

- Local demo mode: stores events and groups in the browser with `localStorage`.
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
5. Add one row per user in `public.profiles`.

Example profile row:

```sql
INSERT INTO public.profiles (id, email, display_name, role)
VALUES ('USER_UUID_FROM_AUTH_USERS', 'admin@example.go.th', 'ผู้ดูแลระบบกลาง', 'admin');
```

Supported roles:

- `admin`: manage all events and groups.
- `officer`: create events and manage only events they created.

The SQL enables RLS. Calendar events and groups are publicly readable, but writes require an authenticated user and are checked by owner/admin policies.

## Checks

```bash
npm run lint
npm run build
npm audit --omit=dev
```
