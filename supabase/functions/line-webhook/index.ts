// Production LINE webhook: replies to the "/today" command with today's calendar digest.
// Reply API is free and does not count against the push message quota.
// See docs/line-notifications.md for setup (Channel secret, webhook URL).
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildAltText, buildFlexContents, EventRow, fetchEventsForDate, todayInBangkok } from "../_shared/lineDigest.ts";

const TRIGGER_COMMAND = "/today";

type LineWebhookEvent = {
  type: string;
  replyToken?: string;
  message?: { type: string; text?: string };
  source?: { userId?: string; groupId?: string; roomId?: string };
};

const timingSafeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
};

const verifySignature = async (rawBody: string, signature: string | null, channelSecret: string): Promise<boolean> => {
  if (!signature) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(channelSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  return timingSafeEqual(expected, signature);
};

const replyToLine = async (replyToken: string, dateIso: string, events: EventRow[]) => {
  const token = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN");
  if (!token) throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not configured");

  const response = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [
        {
          type: "flex",
          altText: buildAltText(dateIso, events),
          contents: buildFlexContents(dateIso, events),
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`LINE reply failed (${response.status}): ${body}`);
  }
};

Deno.serve(async (req) => {
  const rawBody = await req.text();

  const channelSecret = Deno.env.get("LINE_CHANNEL_SECRET");
  if (channelSecret) {
    const signature = req.headers.get("x-line-signature");
    if (!(await verifySignature(rawBody, signature, channelSecret))) {
      return new Response("Invalid signature", { status: 401 });
    }
  }

  let payload: { events?: LineWebhookEvent[] };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("OK", { status: 200 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  for (const event of payload.events ?? []) {
    console.log("LINE event:", event.type, event.source?.groupId ?? event.source?.roomId ?? event.source?.userId);

    if (
      event.type !== "message" ||
      event.message?.type !== "text" ||
      event.message.text?.trim().toLowerCase() !== TRIGGER_COMMAND ||
      !event.replyToken
    ) {
      continue;
    }

    try {
      const dateIso = todayInBangkok();
      const events = await fetchEventsForDate(supabase, dateIso);
      await replyToLine(event.replyToken, dateIso, events);
    } catch (err) {
      console.error("Failed to reply to LINE event:", err);
    }
  }

  return new Response("OK", { status: 200 });
});
