import { Calendar, Clock, Copy, MapPin, User, Video } from "lucide-react";
import { EventData, Group } from "../types";
import { getGroupBadgeStyle, getGroupPalette } from "../utils/groupColors";
import {
  getOnlineResourceDescription,
  getOnlineResourceLabel,
} from "../utils/booking";
import MeetingLink from "./MeetingLink";
import ParticipantPdfActions from "./ParticipantPdfActions";

interface CalendarEventCardProps {
  event: EventData;
  group?: Group;
  view: "day" | "agenda";
  occurrenceDate: string;
  dateRangeLabel?: string;
  isLoggedIn: boolean;
  canManage: boolean;
  onEdit: (event: EventData) => void;
  onDuplicate: (event: EventData) => void;
  onDelete: (id: string) => void;
  onOpenParticipantPdf: (path: string, download?: boolean) => Promise<void>;
}

export default function CalendarEventCard({
  event,
  group,
  view,
  occurrenceDate,
  dateRangeLabel,
  isLoggedIn,
  canManage,
  onEdit,
  onDuplicate,
  onDelete,
  onOpenParticipantPdf,
}: CalendarEventCardProps) {
  const showMeeting = !!(event.is_online && event.online_link);
  const showManagement = isLoggedIn && canManage;
  const showActions = showMeeting || showManagement;
  const cardId =
    view === "day"
      ? `event-item-${event.id}`
      : `agenda-event-${event.id}-${occurrenceDate}`;
  const actionId = (action: string) =>
    view === "day"
      ? `${action}-event-${event.id}-btn`
      : `agenda-${action}-event-${event.id}-${occurrenceDate}-btn`;
  const Heading = view === "agenda" ? "h5" : "h4";
  const platform =
    event.online_platform === "zoom"
      ? "Zoom"
      : event.online_platform === "webex"
        ? "Webex"
        : event.online_platform
          ? "กำหนดเอง"
          : "";

  return (
    <article
      id={cardId}
      aria-labelledby={`${cardId}-title`}
      className={`calendar-event-card event-copy relative grid w-full min-w-0 gap-3 overflow-hidden rounded-xl border border-slate-200/80 bg-white p-3.5 pl-4 transition-shadow hover:shadow-md hover:shadow-slate-900/5 sm:p-4 sm:pl-5 ${showActions ? "@2xl:grid-cols-[minmax(0,1fr)_16rem] @2xl:gap-4" : ""}`}
    >
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: getGroupPalette(group?.color).color }} />
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium">
          <span className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2 py-1 font-semibold tabular-nums text-white">
            <Clock
              className="h-3 w-3 shrink-0 text-red-300"
              aria-hidden="true"
            />
            {event.start_time && event.end_time
              ? `${event.start_time} - ${event.end_time} น.`
              : "ตลอดทั้งวัน"}
          </span>
          {dateRangeLabel && (
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-slate-700">
              <Calendar className="h-3 w-3 shrink-0" aria-hidden="true" />
              ต่อเนื่อง: {dateRangeLabel}
            </span>
          )}
          <span
            className="rounded-md border px-2 py-1"
            style={getGroupBadgeStyle(group)}
          >
            {group?.name || "ไม่ระบุกลุ่มงาน"}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 ${event.is_online ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-blue-100 bg-blue-50 text-blue-800"}`}
          >
            {event.is_online ? (
              <Video className="h-3 w-3 shrink-0" aria-hidden="true" />
            ) : (
              <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
            )}
            {event.is_online
              ? `ออนไลน์${platform ? ` (${platform})` : ""}`
              : "ออนไซต์ (ในสถานที่)"}
          </span>
        </div>

        <Heading
          id={`${cardId}-title`}
          className="font-semibold leading-snug text-slate-900"
        >
          {event.title}
        </Heading>
        {event.description && (
          <p className="whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 leading-relaxed text-slate-600">
            {event.description}
          </p>
        )}
        {event.participant_pdf_path && (
          <ParticipantPdfActions
            path={event.participant_pdf_path}
            onOpen={onOpenParticipantPdf}
          />
        )}

        <div className="flex flex-wrap items-start gap-x-4 gap-y-1.5 pt-0.5 text-sm text-slate-600">
          <span className="inline-flex min-w-0 items-start gap-1">
            <MapPin
              className="mt-0.5 h-3.5 w-3.5 shrink-0"
              aria-hidden="true"
            />
            <span>{event.location || "ไม่ระบุสถานที่"}</span>
          </span>
          {showMeeting && (
            <span className="flex min-w-0 flex-wrap items-start gap-1">
              <span className="inline-flex shrink-0 items-center gap-1">
                <Video className="h-3.5 w-3.5" aria-hidden="true" />
                ลิงก์ออนไลน์:
              </span>
              <MeetingLink link={event.online_link!} meeting={event} />
            </span>
          )}
          {event.is_online && event.online_resource && (
            <span className="inline-flex min-w-0 items-start gap-1">
              <Video
                className="mt-0.5 h-3.5 w-3.5 shrink-0"
                aria-hidden="true"
              />
              <span>
                จอง {getOnlineResourceLabel(event.online_resource)}:{" "}
                {getOnlineResourceDescription(event.online_resource)}
              </span>
            </span>
          )}
          <span className="inline-flex min-w-0 basis-full items-start gap-1 text-xs text-slate-500">
            <User className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>บันทึกโดย {event.created_by || "ผู้ดูแลระบบ"}</span>
          </span>
        </div>
      </div>

      {showActions && (
        <div className="calendar-event-card__actions flex min-w-0 flex-col justify-center gap-2 border-t border-slate-100 pt-3 @2xl:border-t-0 @2xl:border-l @2xl:pt-0 @2xl:pl-4">
          {showMeeting && (
            <MeetingLink link={event.online_link!} meeting={event} button />
          )}
          {showManagement && (
            <div className="grid grid-cols-3 gap-1.5">
              <button
                id={actionId("edit")}
                type="button"
                onClick={() => onEdit(event)}
                className="min-h-10 rounded-lg bg-slate-100 px-2 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-indigo-50 hover:text-indigo-700"
              >
                แก้ไข
              </button>
              <button
                id={actionId("duplicate")}
                type="button"
                onClick={() => onDuplicate(event)}
                title="ทำซ้ำกิจกรรมนี้เป็นรอบใหม่"
                className="inline-flex min-h-10 items-center justify-center gap-1 rounded-lg bg-slate-100 px-2 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-emerald-50 hover:text-emerald-800"
              >
                <Copy className="h-3 w-3 shrink-0" aria-hidden="true" />
                ทำซ้ำ
              </button>
              <button
                id={actionId("delete")}
                type="button"
                onClick={() => onDelete(event.id)}
                className="min-h-10 rounded-lg bg-slate-100 px-2 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-red-50 hover:text-red-700"
              >
                ลบ
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
