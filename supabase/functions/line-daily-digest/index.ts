// Daily LINE digest of today's calendar events, sent as a Flex Message card.
// Triggered by a Supabase Cron Job (pg_cron + pg_net) — see docs/line-notifications.md.
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildAltText,
  buildFlexContents,
  EventRow,
  fetchEventsForDate,
  todayInBangkok,
} from "../_shared/lineDigest.ts";

const pushToLine = async (dateIso: string, events: EventRow[]) => {
  const token = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN");
  const groupId = Deno.env.get("LINE_GROUP_ID");
  if (!token || !groupId) {
    throw new Error("LINE_CHANNEL_ACCESS_TOKEN or LINE_GROUP_ID is not configured");
  }

  const response = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      to: groupId,
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
    throw new Error(`LINE push failed (${response.status}): ${body}`);
  }
};

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret && req.headers.get("x-cron-secret") !== cronSecret) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const dateOverride = url.searchParams.get("date");
  const dateIso = dateOverride || todayInBangkok();

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const events = await fetchEventsForDate(supabase, dateIso);

    let lineStatus = "skipped";
    try {
      await pushToLine(dateIso, events);
      lineStatus = "sent";
    } catch (lineError) {
      console.error("Failed to push to LINE:", lineError);
      lineStatus = `error: ${(lineError as Error).message}`;
    }

    return new Response(
      JSON.stringify({ ok: lineStatus === "sent", date: dateIso, eventCount: events.length, lineStatus }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("line-daily-digest failed:", err);
    return new Response(JSON.stringify({ ok: false, error: (err as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
