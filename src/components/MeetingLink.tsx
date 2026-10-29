import { SyntheticEvent } from "react";
import { Clock, Video } from "lucide-react";
import { getMeetingUrl } from "../utils/meetingUrl";
import { hasMeetingEnded, MeetingSchedule } from "../utils/meetingTime";
import useMeetingExpiry from "../hooks/useMeetingExpiry";

export default function MeetingLink({ link, meeting, button = false }: {
  link: string;
  meeting: MeetingSchedule;
  button?: boolean;
}) {
  const { endsAt, hasEnded, recheck } = useMeetingExpiry(meeting);
  if (hasEnded || endsAt === null) {
    return (
      <span role="status" className={button
        ? "inline-flex min-h-11 max-w-64 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-center text-sm font-semibold text-slate-700"
        : "inline-flex items-center gap-1 text-slate-700"}>
        <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
        {hasEnded ? "การประชุมสิ้นสุดแล้ว ไม่สามารถเปิดลิงก์ได้" : "ไม่พบเวลาสิ้นสุดที่ถูกต้อง กรุณาติดต่อผู้ลงบันทึก"}
      </span>
    );
  }

  const href = getMeetingUrl(link);
  if (!href) return button ? null : <span className="text-amber-800">ลิงก์ประชุมไม่ถูกต้อง กรุณาติดต่อผู้ลงบันทึก</span>;
  const guardExpiry = (event: SyntheticEvent<HTMLAnchorElement>) => {
    // Recheck at activation too, in case the browser suspended the expiry timer.
    if (hasMeetingEnded(endsAt)) {
      event.preventDefault();
      recheck();
    }
  };
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={guardExpiry}
      onAuxClick={guardExpiry}
      onContextMenu={guardExpiry}
      className={button
        ? "inline-flex min-h-11 items-center justify-center gap-2 px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-sm font-semibold"
        : "inline-flex items-center gap-1 text-emerald-800 underline underline-offset-4 hover:text-emerald-950"}
    >
      {button && <Video className="w-4 h-4 shrink-0" aria-hidden="true" />}
      {button ? "เข้าร่วมประชุม" : "เปิดลิงก์ประชุม"}
      <span className="sr-only"> (เปิดแท็บใหม่)</span>
    </a>
  );
}
