import { Video } from "lucide-react";
import { getMeetingUrl } from "../utils/meetingUrl";

export default function MeetingLink({ link, button = false }: { link: string; button?: boolean }) {
  const href = getMeetingUrl(link);
  if (!href) return button ? null : <span className="text-amber-800">ลิงก์ประชุมไม่ถูกต้อง กรุณาติดต่อผู้ลงบันทึก</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
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
