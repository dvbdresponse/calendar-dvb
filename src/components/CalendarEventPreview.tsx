import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Clock, MapPin, User, Video } from "lucide-react";
import { EventData, Group } from "../types";
import { getMeetingUrl } from "../utils/meetingUrl";
import { getOnlineResourceLabel } from "../utils/booking";
import useMeetingExpiry from "../hooks/useMeetingExpiry";

export interface CalendarPreview {
  event: EventData;
  group?: Group;
  anchor: HTMLElement;
  date: string;
}

export default function CalendarEventPreview({ preview, onDismiss }: {
  preview: CalendarPreview;
  onDismiss: () => void;
}) {
  const { event, group, anchor } = preview;
  const { endsAt, hasEnded } = useMeetingExpiry(event);
  const cardRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card || !anchor.isConnected) return;
    const rect = anchor.getBoundingClientRect();
    const { width, height } = card.getBoundingClientRect();
    const gap = 8;
    const viewportWidth = document.documentElement.clientWidth;
    const left = Math.max(gap, Math.min(rect.left + rect.width / 2 - width / 2, viewportWidth - width - gap));
    const above = rect.top - height - gap;
    const top = above >= gap ? above : Math.max(gap, Math.min(rect.bottom + gap, window.innerHeight - height - gap));
    setPosition({ left, top });
  }, [event, anchor, hasEnded, endsAt]);

  useEffect(() => {
    const dismissOnEscape = (key: KeyboardEvent) => { if (key.key === "Escape") onDismiss(); };
    window.addEventListener("scroll", onDismiss, true);
    window.addEventListener("resize", onDismiss);
    document.addEventListener("keydown", dismissOnEscape);
    return () => {
      window.removeEventListener("scroll", onDismiss, true);
      window.removeEventListener("resize", onDismiss);
      document.removeEventListener("keydown", dismissOnEscape);
    };
  }, [onDismiss]);

  return createPortal(
    <div
      id="calendar-event-preview"
      role="tooltip"
      ref={cardRef}
      style={{ left: position?.left ?? 0, top: position?.top ?? 0, visibility: position ? "visible" : "hidden" }}
      className="calendar-event-preview fixed z-[90] flex w-72 max-w-[calc(100vw-1rem)] flex-col gap-3 overflow-hidden rounded-2xl border border-slate-200 bg-white p-3.5 text-left text-sm text-slate-700 shadow-xl pointer-events-none"
    >
      <div className="flex shrink-0 items-start gap-2 border-b border-slate-100 pb-2">
        <p className="min-w-0 flex-1 line-clamp-3 font-bold leading-5 text-slate-900">{event.title}</p>
        {event.is_online && <span className="shrink-0 rounded-md bg-emerald-50 px-1.5 py-0.5 text-xs font-semibold text-emerald-800">ออนไลน์</span>}
      </div>

      <div className="min-h-0 space-y-2 overflow-hidden">
        <div className="grid grid-cols-[1rem_minmax(0,1fr)] items-start gap-2">
          <Clock className="mt-0.5 h-4 w-4" aria-hidden="true" />
          <span>{event.start_time ? `${event.start_time} - ${event.end_time || ""} น.` : "ตลอดทั้งวัน"}</span>
        </div>
        <div className="grid grid-cols-[1rem_minmax(0,1fr)] items-start gap-2">
          <User className="mt-0.5 h-4 w-4" aria-hidden="true" />
          <span className="line-clamp-2">{group?.name || "ไม่ระบุกลุ่มงาน"}</span>
        </div>
        {event.location && (
          <div className="grid grid-cols-[1rem_minmax(0,1fr)] items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4" aria-hidden="true" />
            <span className="line-clamp-2">{event.location}</span>
          </div>
        )}
        {event.is_online && event.online_link && (
          <div className="grid grid-cols-[1rem_minmax(0,1fr)] items-start gap-2">
            <Video className="mt-0.5 h-4 w-4 text-emerald-700" aria-hidden="true" />
            <span>{hasEnded ? "การประชุมสิ้นสุดแล้ว ไม่สามารถเปิดลิงก์ได้" : endsAt === null ? "ไม่พบเวลาสิ้นสุดที่ถูกต้อง" : getMeetingUrl(event.online_link) ? "มีลิงก์ประชุม" : "ลิงก์ประชุมไม่ถูกต้อง"}</span>
          </div>
        )}
        {event.is_online && event.online_resource && <p className="line-clamp-2">จอง {getOnlineResourceLabel(event.online_resource)}</p>}
        {event.description && <p className="line-clamp-2 border-t border-slate-100 pt-2 text-xs leading-relaxed text-slate-600">{event.description}</p>}
      </div>

      <p className="shrink-0 border-t border-slate-100 pt-2 text-xs text-slate-600">เลือกวันที่เพื่อดูรายละเอียดทั้งหมด</p>
    </div>,
    document.body,
  );
}
