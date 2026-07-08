# LINE Daily Digest Notifications

Sends a daily summary of the day's calendar events to a LINE group every morning (~07:00–08:00 Thailand time), via the LINE Messaging API. This is a Supabase Edge Function triggered by a Supabase Cron Job — it does not touch the frontend or the app's `.env` config.

## 1. Create a LINE Messaging API channel

1. Go to the [LINE Developers Console](https://developers.line.biz/console/) and create (or select) a Provider.
2. Create a new channel of type **Messaging API**. This gives you a LINE Official Account (bot).
3. In the channel's **Messaging API** tab:
   - Disable "Auto-reply messages" and "Greeting messages" (optional, keeps the bot quiet outside of the digest).
   - Issue a **Channel access token**. Use the long-lived token option (or the OAuth v2.1 endpoint for a non-expiring token) — the default 30-day token will require manual renewal.
4. Note the **Channel access token** — this becomes the `LINE_CHANNEL_ACCESS_TOKEN` secret.

## 2. Invite the bot into your LINE group

1. Add the Official Account as a friend (scan the QR code on the channel's Messaging API tab).
2. Invite it into the **LINE group** that should receive the daily digest. It must be a group chat (not a 1-on-1 chat or a "room"), and the bot must remain a member.

## 3. Find the group's ID

LINE does not show group IDs anywhere in the console — the only way to get one is to read it off an incoming webhook event.

1. Deploy the throwaway helper function in this repo:
   ```
   supabase functions deploy line-webhook-debug --no-verify-jwt
   ```
2. In the channel's Messaging API tab, set the **Webhook URL** to:
   ```
   https://<your-project-ref>.supabase.co/functions/v1/line-webhook-debug
   ```
   and enable "Use webhook".
3. Send any message in the LINE group (or re-invite the bot to trigger a "join" event).
4. Check the function logs:
   ```
   supabase functions logs line-webhook-debug
   ```
   Find `event.source.groupId` (starts with `C`) in the logged payload — this is your `LINE_GROUP_ID`.
5. Once you have the group ID, you can turn the webhook off (clear the Webhook URL, or leave "Use webhook" disabled) and delete `supabase/functions/line-webhook-debug` — it's only needed for this bootstrap step.

## 4. Set secrets

```
supabase secrets set LINE_CHANNEL_ACCESS_TOKEN=<token from step 1>
supabase secrets set LINE_GROUP_ID=<group id from step 3>
supabase secrets set CRON_SECRET=<any long random string>
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are already available inside every Edge Function automatically — you don't need to set those.

## 5. Deploy the digest function

```
supabase link --project-ref tvvjdzqcapraebvmztly
supabase functions deploy line-daily-digest --no-verify-jwt
```

`--no-verify-jwt` is required because the Cron Job calls this function with no user session. The function protects itself instead by checking the `x-cron-secret` header against your `CRON_SECRET` value.

## 6. Schedule it

Run this once in the Supabase SQL Editor (Dashboard → SQL Editor):

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'line-daily-digest-0700-ict',
  '30 0 * * *',  -- 00:30 UTC = 07:30 Thailand time (ICT, UTC+7)
  $$
  select net.http_post(
    url := 'https://tvvjdzqcapraebvmztly.supabase.co/functions/v1/line-daily-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<paste your CRON_SECRET here>'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Adjust the cron expression if you want a different time within the requested window:
- `0 0 * * *` → 07:00 ICT
- `30 0 * * *` → 07:30 ICT (default above)
- `0 1 * * *` → 08:00 ICT

For better secret hygiene, store `CRON_SECRET` in [Supabase Vault](https://supabase.com/docs/guides/database/vault) and reference it via `vault.decrypted_secrets` instead of pasting it directly into this SQL — recommended if others can view your SQL Editor history, but pasting it directly is fine for a small internal tool.

## 7. Test

Local, before deploying:
```
supabase functions serve line-daily-digest --env-file supabase/.env.local --no-verify-jwt
curl -i "http://localhost:54321/functions/v1/line-daily-digest?date=2026-07-15" \
  -H "x-cron-secret: <CRON_SECRET>"
```
(Create `supabase/.env.local`, gitignored, with `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_GROUP_ID`, `CRON_SECRET` for local testing.)

Try a date with no events to confirm the "no events today" fallback message, and a date with events to confirm formatting.

After deploying, trigger it once manually to confirm delivery before relying on the cron schedule:
```
curl -i "https://tvvjdzqcapraebvmztly.supabase.co/functions/v1/line-daily-digest" \
  -H "x-cron-secret: <CRON_SECRET>"
```

## Troubleshooting

- **401 from LINE / push fails with "Invalid channel access token"**: the token expired or was revoked — reissue it in the console and update the secret.
- **404 from LINE on push**: the bot is no longer a member of the group (someone removed it) — re-invite it, then re-check the group ID (it should stay the same).
- **Message quota**: free-tier LINE Official Accounts have a monthly push message limit (commonly 200/month for unverified accounts). One digest per day is ~30 messages/month, comfortably within the free tier.
- **Nothing happens at the scheduled time**: check `select * from cron.job_run_details order by start_time desc limit 5;` in the SQL Editor, and `supabase functions logs line-daily-digest` for errors.
