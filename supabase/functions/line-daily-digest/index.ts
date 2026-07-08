// Daily LINE digest of today's calendar events.
// Triggered by a Supabase Cron Job (pg_cron + pg_net) — see docs/line-notifications.md.
import { createClient } from "npm:@supabase/supabase-js@2";

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

// Groups whose events should never appear in the LINE digest (e.g. internal-only work groups).
const EXCLUDED_GROUP_IDS = ["group-1783491363236"];

const todayInBangkok = (): string => {
  const bangkokNow = new Date(Date.now() + BANGKOK_OFFSET_MS);
  return bangkokNow.toISOString().slice(0, 10);
};

const THAI_WEEKDAYS = ["วันอาทิตย์", "วันจันทร์", "วันอังคาร", "วันพุธ", "วันพฤหัสบดี", "วันศุกร์", "วันเสาร์"];
const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

const formatThaiDate = (isoDate: string): string => {
  const [y, m, d] = isoDate.split("-").map(Number);
  const utcDate = new Date(Date.UTC(y, m - 1, d));
  const weekday = THAI_WEEKDAYS[utcDate.getUTCDay()];
  const buddhistYear = y + 543;
  return `${weekday}ที่ ${d} ${THAI_MONTHS[m - 1]} ${buddhistYear}`;
};

type EventRow = {
  title: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  is_online: boolean | null;
  online_link: string | null;
  is_holiday: boolean | null;
  group_id: string | null;
  groups: { label: string; name: string } | null;
};

const formatEventLine = (event: EventRow): string => {
  const groupLabel = event.groups?.label ?? event.groups?.name;
  const parts: string[] = [];

  if (event.is_holiday) {
    parts.push(`🎌 วันหยุด: ${event.title}`);
  } else {
    const time = event.start_time
      ? `${event.start_time}${event.end_time ? `-${event.end_time}` : ""} น.`
      : "ไม่ระบุเวลา";
    parts.push(`🕘 ${time} ${event.title}${groupLabel ? ` (${groupLabel})` : ""}`);
  }

  if (event.is_online && event.online_link) {
    parts.push(`   💻 ${event.online_link}`);
  } else if (event.location) {
    parts.push(`   📍 ${event.location}`);
  }

  return parts.join("\n");
};

const buildDigest = (dateIso: string, events: EventRow[]): string => {
  const header = `📅 กำหนดการวันนี้ (${formatThaiDate(dateIso)})`;

  if (events.length === 0) {
    return `${header}\n\nวันนี้ไม่มีนัดหมายในปฏิทิน`;
  }

  const timed = events.filter((e) => e.is_holiday || e.start_time);
  const untimed = events.filter((e) => !e.is_holiday && !e.start_time);
  const sorted = [
    ...timed.sort((a, b) => (a.is_holiday ? -1 : 1) - (b.is_holiday ? -1 : 1) || (a.start_time || "").localeCompare(b.start_time || "")),
    ...untimed,
  ];

  const MAX_LINES = 40;
  const shown = sorted.slice(0, MAX_LINES);
  const lines = shown.map(formatEventLine).join("\n\n");
  const overflow = sorted.length > MAX_LINES ? `\n\nและอีก ${sorted.length - MAX_LINES} รายการ` : "";

  return `${header}\n\n${lines}${overflow}\n\nรวม ${events.length} รายการ`;
};

const pushToLine = async (text: string) => {
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
    body: JSON.stringify({ to: groupId, messages: [{ type: "text", text }] }),
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

    const { data, error } = await supabase
      .from("events")
      .select("title, start_time, end_time, location, is_online, online_link, is_holiday, group_id, groups(label, name)")
      .lte("date", dateIso)
      .or(`end_date.gte.${dateIso},and(end_date.is.null,date.eq.${dateIso})`);

    if (error) throw error;

    const events = ((data ?? []) as unknown as EventRow[]).filter(
      (event) => !EXCLUDED_GROUP_IDS.includes(event.group_id ?? ""),
    );
    const digest = buildDigest(dateIso, events);

    let lineStatus = "skipped";
    try {
      await pushToLine(digest);
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
