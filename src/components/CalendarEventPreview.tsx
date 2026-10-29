import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Clock, MapPin, User, Video } from "lucide-react";
import { EventData, Group } from "../types";
import { getMeetingUrl } from "../utils/meetingUrl";
import { getOnlineResourceLabel } from "../utils/booking";
import useMeetingExpiry from "../hooks/useMeetingExpiry";
import { getGroupBadgeStyle } from "../utils/groupColors";

export interface CalendarPreview {
  event: EventData;
  group?: Group;
  anchor: HTMLElement;
  date: string;
}

export default function CalendarEventPreview({
  preview,
  onDismiss,
}: {
  preview: CalendarPreview;
  onDismiss: () => void;
}) {
  const { event, group, anchor } = preview;
  const { endsAt, hasEnded } = useMeetingExpiry(event);
  const cardRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card || !anchor.isConnected) return;
    const rect = anchor.getBoundingClientRect();
    const { width, height } = card.getBoundingClientRect();
    const gap = 8;
    const viewportWidth = document.documentElement.clientWidth;
    const left = Math.max(
      gap,
      Math.min(
        rect.left + rect.width / 2 - width / 2,
        viewportWidth - width - gap,
      ),
    );
    const above = rect.top - height - gap;
    const top =
      above >= gap
        ? above
        : Math.max(
            gap,
            Math.min(rect.bottom + gap, window.innerHeight - height - gap),
          );
    setPosition({ left, top });
  }, [event, anchor, hasEnded, endsAt]);

  useEffect(() => {
    const dismissOnEscape = (key: KeyboardEvent) => {
      if (key.key === "Escape") onDismiss();
    };
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
      style={{
        left: position?.left ?? 0,
        top: position?.top ?? 0,
        visibility: position ? "visible" : "hidden",
      }}
      className="calendar-event-preview fixed z-[90] flex w-[44rem] max-w-[calc(100vw-1rem)] flex-col gap-3 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 text-left text-sm text-slate-700 shadow-xl pointer-events-none"
    >
      <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs font-semibold">
        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-slate-700">
          <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
          {event.start_time
            ? `${event.start_time} - ${event.end_time || ""} น.`
            : "ตลอดทั้งวัน"}
        </span>
        <span
          className="max-w-full truncate rounded-md border px-2 py-1"
          style={getGroupBadgeStyle(group)}
        >
          {group?.name || "ไม่ระบุกลุ่มงาน"}
        </span>
        {event.is_online && (
          <span className="rounded-md bg-emerald-50 px-2 py-1 text-emerald-800">
            ออนไลน์
          </span>
        )}
      </div>

      <div className="grid min-h-0 gap-4 overflow-hidden sm:grid-cols-[minmax(0,1fr)_14rem]">
        <div className="min-w-0 space-y-2">
          <p className="line-clamp-3 text-base font-bold leading-6 text-slate-900">
            {event.title}
          </p>
          {event.description && (
            <p className="line-clamp-2 rounded-lg border border-slate-100 bg-slate-50/50 p-2 leading-relaxed text-slate-600">
              {event.description}
            </p>
          )}
          {event.location && (
            <p className="flex items-start gap-1">
              <MapPin
                className="mt-0.5 h-3.5 w-3.5 shrink-0"
                aria-hidden="true"
              />
              <span className="line-clamp-2">สถานที่: {event.location}</span>
            </p>
          )}
          <p className="flex items-start gap-1">
            <User className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="line-clamp-2">
              ผู้ลงบันทึก: {event.created_by || "ผู้ดูแลระบบ"}
            </span>
          </p>
          {event.is_online && event.online_resource && (
            <p className="line-clamp-2">
              จอง {getOnlineResourceLabel(event.online_resource)}
            </p>
          )}
        </div>
        {event.is_online && event.online_link && (
          <div className="min-w-0 border-t border-slate-100 pt-3 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-4">
            <div
              className={`flex items-start gap-2 rounded-lg border p-3 ${hasEnded ? "border-slate-200 bg-slate-100 text-slate-700" : "border-emerald-100 bg-emerald-50 text-emerald-800"}`}
            >
              <Video className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                {hasEnded
                  ? "การประชุมสิ้นสุดแล้ว ไม่สามารถเปิดลิงก์ได้"
                  : endsAt === null
                    ? "ไม่พบเวลาสิ้นสุดที่ถูกต้อง"
                    : getMeetingUrl(event.online_link)
                      ? "มีลิงก์ประชุม"
                      : "ลิงก์ประชุมไม่ถูกต้อง"}
              </span>
            </div>
          </div>
        )}
      </div>

      <p className="shrink-0 border-t border-slate-100 pt-2 text-xs text-slate-600">
        เลือกวันที่เพื่อดูรายละเอียดทั้งหมด
      </p>
    </div>,
    document.body,
  );
}
