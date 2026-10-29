import { EventData } from "../types";

export type MeetingSchedule = Pick<EventData, "date" | "end_date" | "end_time">;

/** Meeting dates and times always use Thailand time, independent of the viewer's timezone. */
export function getMeetingEndTimestamp(meeting: MeetingSchedule): number | null {
  const endDate = meeting.end_date || meeting.date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate) || endDate < meeting.date) return null;
  const dateCheck = new Date(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(dateCheck.getTime()) || dateCheck.toISOString().slice(0, 10) !== endDate) return null;

  // Events without an end time stay available through their entire final day.
  if (!meeting.end_time) return Date.parse(`${endDate}T00:00:00+07:00`) + 24 * 60 * 60 * 1000;
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(meeting.end_time)) return null;
  return Date.parse(`${endDate}T${meeting.end_time}+07:00`);
}

export function hasMeetingEnded(endsAt: number | null, now = Date.now()): boolean {
  return endsAt !== null && now >= endsAt;
}
