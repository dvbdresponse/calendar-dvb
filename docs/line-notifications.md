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

LINE does not show group IDs anywhere in the console — the only way to get one is to read it off an incoming webhook event. `line-webhook` (see section 8) logs the source ID of every message it receives, so once it's deployed and set as the Webhook URL, it doubles as the group-ID finder — no separate throwaway function needed.

1. Deploy `line-webhook` and set it as the channel's Webhook URL — follow section 8 first if you haven't already.
2. Send any message in the LINE group you want the ID for.
3. Check the function's logs in the Dashboard:
   ```
   https://supabase.com/dashboard/project/tvvjdzqcapraebvmztly/functions/line-webhook/logs
   ```
   Find the line `LINE event: message <id>` (starts with `C`) — this is that group's `LINE_GROUP_ID`.
4. Repeat per group as needed. Leave the webhook on permanently — `/today` (section 8) depends on it.

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

## 8. On-demand "/today" command (optional)

Anyone in the group can type `/today` to get an immediate reply with today's digest — no waiting for the 07:30 cron. This uses the LINE **Reply API**, which is free and does not count against the push message quota (unlike the daily digest's push, which is also free at this volume but capped monthly).

1. In the LINE Developers Console, channel's **Basic settings** tab, copy the **Channel secret** (different from the channel access token — used to verify that webhook requests really come from LINE).
2. Set it as a secret:
   ```
   supabase secrets set LINE_CHANNEL_SECRET=<channel secret from step 1>
   ```
3. Deploy the webhook function:
   ```
   supabase functions deploy line-webhook --no-verify-jwt
   ```
4. In the channel's **Messaging API** tab, set the **Webhook URL** to:
   ```
   https://tvvjdzqcapraebvmztly.supabase.co/functions/v1/line-webhook
   ```
   and turn "Use webhook" **ON** (leave it on permanently — `/today` and future group-ID lookups both depend on it).
5. In the LINE group, type `/today` — or the equivalents `วันนี้`, `นัดหมายวันนี้`, `กำหนดการวันนี้`, `ประชุม`, `meeting`. The bot should reply within a couple seconds with the same Flex card the daily digest sends.

The whole message must exactly equal one of the trigger words (case-insensitive, whitespace-trimmed) — a sentence merely containing them is ignored, so normal chat like "เดี๋ยวเจอกันวันนี้นะ" doesn't set the bot off. Everything else is ignored (logged as `LINE event: message <sourceId>` for visibility, but no message text is logged to avoid storing group chat content).

## Troubleshooting

- **401 from LINE / push fails with "Invalid channel access token"**: the token expired or was revoked — reissue it in the console and update the secret.
- **404 from LINE on push**: the bot is no longer a member of the group (someone removed it) — re-invite it, then re-check the group ID (it should stay the same). Unverified LINE Official Accounts also can't stay in a group chat with 101+ members — this is a LINE platform restriction, not something fixable in code; see LINE's Official Account verification process if the target group is that large.
- **Message quota**: free-tier LINE Official Accounts have a monthly push message limit (commonly 200/month for unverified accounts). One digest per day is ~30 messages/month, comfortably within the free tier. Pushing to a group counts as 1 message per call regardless of group size (unlike multicast, which counts per recipient).
- **`/today` gets no reply**: check the Webhook URL is set to `line-webhook` and "Use webhook" is ON. A 401 in the logs means `LINE_CHANNEL_SECRET` doesn't match the channel's actual Basic settings secret.
- **Nothing happens at the scheduled time, or checking any function's logs**: recent Supabase CLI versions removed `supabase functions logs` — use the Dashboard instead: `https://supabase.com/dashboard/project/tvvjdzqcapraebvmztly/functions/<function-name>/logs`. For the cron schedule itself, check `select * from cron.job_run_details order by start_time desc limit 5;` in the SQL Editor.
