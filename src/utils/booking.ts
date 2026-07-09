import { EventData } from "../types";

export const OFFICE_BOOKABLE_ROOMS = [
  "ห้องประชุม สคอ.(ใหญ่)",
  "ห้องประชุม สคอ.(เล็ก)",
  "ห้องประชุม ผอ.",
];

export const ONLINE_RESOURCES = [
  { id: "", label: "เข้าร่วมประชุมภายนอก / ไม่จองห้องออนไลน์ของสำนัก", description: "ใส่ลิงก์ประชุมได้ โดยไม่กันเวลา Zoom/Webex ของสำนัก" },
  { id: "office_zoom", label: "จอง Zoom ของสำนัก", description: "บัญชี Zoom ของสำนัก" },
  { id: "office_webex", label: "จอง Webex ของสำนัก", description: "บัญชี Webex ของสำนัก" },
];

type BookingCandidate = Pick<
  EventData,
  "id" | "title" | "date" | "end_date" | "start_time" | "end_time" | "location" | "is_online" | "online_resource" | "is_holiday"
>;

export const isOfficeBookableRoom = (location?: string) => (
  !!location && OFFICE_BOOKABLE_ROOMS.includes(location)
);

export const getOnlineResourceLabel = (resource?: string) => {
  if (resource === "office_zoom") return "Zoom สำนัก";
  if (resource === "office_webex") return "Webex สำนัก";
  return "";
};

export const getOnlineResourceDescription = (resource?: string) => {
  if (resource === "office_zoom") return "บัญชี Zoom ของสำนัก";
  if (resource === "office_webex") return "บัญชี Webex ของสำนัก";
  return "";
};

export const getOnlineResourceLink = (resource?: string) => {
  if (resource === "office_zoom") return "https://zoom.us/j/2225903373?pwd=L9fLyJjQy1hnzJeMgTZ8BoYjbHhEGH.1";
  return "";
};

const getEndDate = (event: BookingCandidate) => event.end_date || event.date;

const hasDateOverlap = (a: BookingCandidate, b: BookingCandidate) => (
  a.date <= getEndDate(b) && getEndDate(a) >= b.date
);

const isAllDayBooking = (event: BookingCandidate) => (
  !event.start_time || !event.end_time || getEndDate(event) !== event.date
);

const hasTimeOverlap = (a: BookingCandidate, b: BookingCandidate) => {
  if (!hasDateOverlap(a, b)) return false;
  if (isAllDayBooking(a) || isAllDayBooking(b)) return true;
  return a.start_time < b.end_time && a.end_time > b.start_time;
};

export const findBookingConflict = (
  candidate: BookingCandidate,
  events: EventData[],
) => {
  if (candidate.is_holiday) return null;

  const officeRoom = isOfficeBookableRoom(candidate.location) ? candidate.location : "";
  const onlineResource = candidate.is_online ? candidate.online_resource || "" : "";

  if (!officeRoom && !onlineResource) return null;

  for (const event of events) {
    if (event.is_holiday || event.id === candidate.id) continue;
    if (!hasTimeOverlap(candidate, event)) continue;

    if (officeRoom && event.location === officeRoom) {
      return {
        type: "location" as const,
        resourceName: officeRoom,
        event,
      };
    }

    if (onlineResource && event.is_online && event.online_resource === onlineResource) {
      return {
        type: "online_resource" as const,
        resourceName: getOnlineResourceLabel(onlineResource),
        event,
      };
    }
  }

  return null;
};
