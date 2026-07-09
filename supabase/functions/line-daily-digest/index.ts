// Daily LINE digest of today's calendar events, sent as a Flex Message card.
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
  groups: { label: string; name: string; color: string | null } | null;
};

const DEFAULT_STRIPE_COLOR = "#64748B";
const HOLIDAY_STRIPE_COLOR = "#D97706";
const MAX_ITEMS = 20;

const sortEvents = (events: EventRow[]): EventRow[] => {
  const timed = events.filter((e) => e.is_holiday || e.start_time);
  const untimed = events.filter((e) => !e.is_holiday && !e.start_time);
  timed.sort(
    (a, b) =>
      (a.is_holiday ? -1 : 1) - (b.is_holiday ? -1 : 1) ||
      (a.start_time || "").localeCompare(b.start_time || ""),
  );
  return [...timed, ...untimed];
};

const isValidLineUri = (url: string | null): url is string =>
  !!url && (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("line://"));

const buildEventBox = (event: EventRow) => {
  const groupLabel = event.groups?.label ?? event.groups?.name;
  const stripeColor = event.is_holiday ? HOLIDAY_STRIPE_COLOR : event.groups?.color || DEFAULT_STRIPE_COLOR;

  const timeText = event.is_holiday
    ? "วันหยุด"
    : event.start_time
      ? `${event.start_time}${event.end_time ? `-${event.end_time}` : ""} น.`
      : "ไม่ระบุเวลา";

  const detailContents: Record<string, unknown>[] = [
    {
      type: "text",
      text: timeText,
      size: "xs",
      weight: "bold",
      color: event.is_holiday ? HOLIDAY_STRIPE_COLOR : "#4F46E5",
    },
    {
      type: "text",
      text: event.title,
      size: "sm",
      weight: "bold",
      wrap: true,
      color: "#1F2937",
      margin: "xs",
    },
  ];

  if (groupLabel) {
    detailContents.push({
      type: "text",
      text: `🏢 ${groupLabel}`,
      size: "xxs",
      color: "#6B7280",
      margin: "xs",
    });
  }

  if (event.is_online && event.online_link) {
    detailContents.push({
      type: "text",
      text: "💻 ประชุมออนไลน์",
      size: "xxs",
      color: "#6B7280",
      margin: "xs",
    });
    if (isValidLineUri(event.online_link)) {
      detailContents.push({
        type: "button",
        style: "link",
        height: "sm",
        margin: "xs",
        action: { type: "uri", label: "เข้าร่วมออนไลน์", uri: event.online_link },
      });
    }
  } else if (event.location) {
    detailContents.push({
      type: "text",
      text: `📍 ${event.location}`,
      size: "xxs",
      color: "#6B7280",
      margin: "xs",
      wrap: true,
    });
  }

  return {
    type: "box",
    layout: "horizontal",
    margin: "md",
    contents: [
      { type: "box", layout: "vertical", width: "6px", backgroundColor: stripeColor, contents: [{ type: "filler" }] },
      { type: "box", layout: "vertical", margin: "md", contents: detailContents },
    ],
  };
};

const buildFlexContents = (dateIso: string, events: EventRow[]) => {
  const sorted = sortEvents(events);
  const shown = sorted.slice(0, MAX_ITEMS);
  const overflowCount = sorted.length - shown.length;

  const bodyContents: Record<string, unknown>[] =
    shown.length === 0
      ? [{ type: "text", text: "วันนี้ไม่มีนัดหมายในปฏิทิน", size: "sm", color: "#6B7280", wrap: true }]
      : shown.map(buildEventBox);

  if (overflowCount > 0) {
    bodyContents.push({
      type: "text",
      text: `และอีก ${overflowCount} รายการ`,
      size: "xs",
      color: "#9CA3AF",
      margin: "md",
      align: "center",
    });
  }

  return {
    type: "bubble",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#4F46E5",
      paddingAll: "16px",
      contents: [
        { type: "text", text: "📅 กำหนดการวันนี้", size: "lg", weight: "bold", color: "#FFFFFF" },
        { type: "text", text: formatThaiDate(dateIso), size: "sm", color: "#E0E7FF", margin: "xs" },
      ],
    },
    body: {
      type: "box",
      layout: "vertical",
      paddingAll: "16px",
      contents: bodyContents,
    },
    footer: {
      type: "box",
      layout: "vertical",
      paddingAll: "12px",
      contents: [
        {
          type: "text",
          text: `รวม ${events.length} รายการ`,
          size: "xs",
          color: "#9CA3AF",
          align: "center",
        },
      ],
    },
  };
};

const buildAltText = (dateIso: string, events: EventRow[]): string => {
  const dateText = formatThaiDate(dateIso);
  if (events.length === 0) return `กำหนดการวันนี้ (${dateText}) — ไม่มีนัดหมาย`;
  return `กำหนดการวันนี้ (${dateText}) มี ${events.length} รายการ`;
};

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

    const { data, error } = await supabase
      .from("events")
      .select("title, start_time, end_time, location, is_online, online_link, is_holiday, group_id, groups(label, name, color)")
      .lte("date", dateIso)
      .or(`end_date.gte.${dateIso},and(end_date.is.null,date.eq.${dateIso})`);

    if (error) throw error;

    const events = ((data ?? []) as unknown as EventRow[]).filter(
      (event) => !EXCLUDED_GROUP_IDS.includes(event.group_id ?? ""),
    );

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
