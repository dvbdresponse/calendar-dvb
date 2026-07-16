// Car-booking helpers for the merged LINE webhook (ALC-Calendar bot).
//
// LINE allows only ONE Official Account per group chat, so the car-booking
// bot's commands were merged into this calendar bot. Booking data lives in a
// DIFFERENT Supabase project (book-car, dimslqsabnlymtrvoyaz); its tables are
// publicly readable (RLS SELECT true), so we read cross-project with the
// public anon key — no service role required.
//
// Required env (set via `supabase secrets set` on the calendar project):
//   BOOKCAR_SUPABASE_URL       e.g. https://dimslqsabnlymtrvoyaz.supabase.co
//   BOOKCAR_SUPABASE_ANON_KEY  book-car public anon key
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";
import { formatThaiDate, todayInBangkok } from "./lineDigest.ts";

export type CarCommand = "today" | "tomorrow" | "yesterday";

// Exact-match car commands ("/" prefix allowed), mirroring the calendar bot's
// exact-match policy so the bot stays silent during normal group chatter.
const CAR_COMMANDS: Record<string, CarCommand> = {
  "ใช้รถ": "today",
  "ใช้รถพรุ่งนี้": "tomorrow",
  "ใช้รถเมื่อวาน": "yesterday",
};

export const parseCarCommand = (text: string): CarCommand | null => {
  let key = text.trim().toLowerCase();
  if (key.startsWith("/")) key = key.slice(1).trim();
  return CAR_COMMANDS[key] ?? null;
};

export const addDaysIso = (iso: string, days: number): string => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
};

export const resolveCarDate = (cmd: CarCommand): { dateIso: string; label: string } => {
  const today = todayInBangkok();
  switch (cmd) {
    case "tomorrow":
      return { dateIso: addDaysIso(today, 1), label: "พรุ่งนี้" };
    case "yesterday":
      return { dateIso: addDaysIso(today, -1), label: "เมื่อวาน" };
    default:
      return { dateIso: today, label: "วันนี้" };
  }
};

let bookcarClient: SupabaseClient | null = null;

// Lazy: only created the first time a car command is actually seen.
export const getBookcarClient = (): SupabaseClient => {
  if (bookcarClient) return bookcarClient;
  const url = Deno.env.get("BOOKCAR_SUPABASE_URL");
  const anonKey = Deno.env.get("BOOKCAR_SUPABASE_ANON_KEY");
  if (!url || !anonKey) {
    throw new Error("BOOKCAR_SUPABASE_URL / BOOKCAR_SUPABASE_ANON_KEY are not configured");
  }
  bookcarClient = createClient(url, anonKey, { auth: { persistSession: false } });
  return bookcarClient;
};

type BookingRow = {
  id: string;
  title: string;
  date: string;
  end_date: string | null;
  start_time: string;
  end_time: string;
  group_id: string;
  vehicle_id: string | null;
  driver_id: string | null;
  passenger_count: number | null;
  requester_name: string | null;
  is_holiday: boolean;
};

type VehicleRow = { id: string; name: string; license_plate: string };
type DriverRow = { id: string; name: string; phone: string | null };
type GroupRow = { id: string; label: string; color: string | null };

export type CarDayData = {
  bookings: BookingRow[];
  holidays: BookingRow[];
  vehicles: Map<string, VehicleRow>;
  drivers: Map<string, DriverRow>;
  groups: Map<string, GroupRow>;
  error: boolean;
};

// Bookings that cover `dateIso`: a single-day booking on that date, or a
// multi-day booking whose [date, end_date] range includes it.
export const fetchCarBookingsForDate = async (
  supabase: SupabaseClient,
  dateIso: string,
): Promise<CarDayData> => {
  const { data, error } = await supabase
    .from("car_bookings")
    .select(
      "id,title,date,end_date,start_time,end_time,group_id,vehicle_id,driver_id,passenger_count,requester_name,is_holiday",
    )
    .or(`date.eq.${dateIso},and(date.lte.${dateIso},end_date.gte.${dateIso})`)
    .order("start_time", { ascending: true });

  if (error) {
    console.error("car_bookings query error:", error);
    return { bookings: [], holidays: [], vehicles: new Map(), drivers: new Map(), groups: new Map(), error: true };
  }

  const rows = (data ?? []) as BookingRow[];
  const holidays = rows.filter((r) => r.is_holiday);
  const bookings = rows.filter((r) => !r.is_holiday);

  // Lookup tables are small; fetch all.
  const [vehiclesRes, driversRes, groupsRes] = await Promise.all([
    supabase.from("vehicles").select("id,name,license_plate"),
    supabase.from("drivers").select("id,name,phone"),
    supabase.from("groups").select("id,label,color"),
  ]);
  const vehicles = new Map<string, VehicleRow>(((vehiclesRes.data ?? []) as VehicleRow[]).map((v) => [v.id, v]));
  const drivers = new Map<string, DriverRow>(((driversRes.data ?? []) as DriverRow[]).map((d) => [d.id, d]));
  const groups = new Map<string, GroupRow>(((groupsRes.data ?? []) as GroupRow[]).map((g) => [g.id, g]));

  return { bookings, holidays, vehicles, drivers, groups, error: false };
};

const timeText = (b: BookingRow): string => {
  if (b.start_time && b.end_time) return `${b.start_time}-${b.end_time} น.`;
  if (b.start_time) return `${b.start_time} น.`;
  return "ตลอดวัน";
};

const DEFAULT_BAR_COLOR = "#94A3B8";

// Slate header — deliberately different from the calendar digest's indigo
// (#4F46E5) so the two cards are easy to tell apart in the same chat.
export const buildCarFlexContents = (data: CarDayData, dateIso: string, label: string) => {
  const { bookings, holidays, vehicles, drivers, groups } = data;
  const holidayText = holidays.length ? holidays.map((h) => h.title).join(", ") : "";

  const bodyContents: Record<string, unknown>[] = [];

  if (data.error) {
    bodyContents.push({
      type: "text",
      text: "⚠️ ดึงข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
      wrap: true,
      color: "#B91C1C",
      size: "sm",
    });
  } else if (bookings.length === 0) {
    bodyContents.push({
      type: "text",
      text: "ไม่มีรายการจองรถ",
      wrap: true,
      color: "#64748B",
      size: "sm",
    });
  } else {
    bookings.forEach((b, i) => {
      if (i > 0) bodyContents.push({ type: "separator", margin: "md", color: "#E2E8F0" });

      const veh = b.vehicle_id ? vehicles.get(b.vehicle_id) : null;
      const drv = b.driver_id ? drivers.get(b.driver_id) : null;
      const grp = groups.get(b.group_id);
      const barColor = grp?.color || DEFAULT_BAR_COLOR;

      const detail: Record<string, unknown>[] = [
        { type: "text", text: b.title, weight: "bold", size: "md", color: "#1E293B", wrap: true },
        { type: "text", text: `🕒 ${timeText(b)}`, size: "sm", color: "#475569", wrap: true },
        {
          type: "text",
          text: `🚐 ${veh ? `${veh.name} (${veh.license_plate})` : "ยังไม่ระบุรถ"}`,
          size: "sm",
          color: "#475569",
          wrap: true,
        },
      ];

      const who: string[] = [];
      if (drv) who.push(`👤 ${drv.name}${drv.phone ? ` (${drv.phone})` : ""}`);
      if (grp) who.push(grp.label);
      if (who.length) {
        detail.push({ type: "text", text: who.join(" · "), size: "sm", color: "#64748B", wrap: true });
      }

      const extra: string[] = [];
      if (b.requester_name) extra.push(`ผู้ขอ ${b.requester_name}`);
      if (b.passenger_count) extra.push(`${b.passenger_count} คน`);
      if (extra.length) {
        detail.push({ type: "text", text: `📝 ${extra.join(" · ")}`, size: "xs", color: "#94A3B8", wrap: true });
      }

      bodyContents.push({
        type: "box",
        layout: "horizontal",
        margin: i > 0 ? "md" : "none",
        spacing: "md",
        contents: [
          { type: "box", layout: "vertical", width: "6px", backgroundColor: barColor, cornerRadius: "3px", contents: [{ type: "filler" }] },
          { type: "box", layout: "vertical", spacing: "2px", flex: 1, contents: detail },
        ],
      });
    });
  }

  if (holidayText) {
    bodyContents.push({ type: "separator", margin: "md", color: "#E2E8F0" });
    bodyContents.push({ type: "text", text: `🎌 ${holidayText}`, size: "xs", color: "#DC2626", wrap: true, margin: "md" });
  }

  return {
    type: "bubble",
    size: "mega",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#1E293B",
      paddingAll: "16px",
      spacing: "2px",
      contents: [
        { type: "text", text: `🚗 การใช้รถ${label}`, color: "#FFFFFF", weight: "bold", size: "lg" },
        { type: "text", text: formatThaiDate(dateIso), color: "#CBD5E1", size: "sm" },
        {
          type: "text",
          text: bookings.length ? `${bookings.length} รายการ` : "ไม่มีรายการจองรถ",
          color: "#94A3B8",
          size: "xs",
        },
      ],
    },
    body: { type: "box", layout: "vertical", paddingAll: "16px", spacing: "md", contents: bodyContents },
  };
};

export const buildCarAltText = (data: CarDayData, dateIso: string, label: string): string => {
  const dateText = formatThaiDate(dateIso);
  const alt = data.bookings.length
    ? `การใช้รถ${label} (${data.bookings.length} รายการ) — ${dateText}`
    : `การใช้รถ${label}: ไม่มีรายการจองรถ — ${dateText}`;
  return alt.slice(0, 400);
};
