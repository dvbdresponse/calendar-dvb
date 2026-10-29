import { useEffect, useReducer } from "react";
import { getMeetingEndTimestamp, hasMeetingEnded, MeetingSchedule } from "../utils/meetingTime";

export default function useMeetingExpiry(meeting: MeetingSchedule) {
  const endsAt = getMeetingEndTimestamp(meeting);
  const [, recheck] = useReducer((revision: number) => revision + 1, 0);

  useEffect(() => {
    if (endsAt === null) return;
    let timer: ReturnType<typeof setTimeout>;
    const check = () => {
      clearTimeout(timer);
      recheck();
      const remaining = endsAt - Date.now();
      // Long-running events may exceed the browser's maximum timeout delay.
      if (remaining > 0) timer = setTimeout(check, Math.min(remaining, 2_147_483_647));
    };
    check();
    window.addEventListener("focus", check);
    window.addEventListener("pageshow", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", check);
      window.removeEventListener("pageshow", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [endsAt]);

  return { endsAt, hasEnded: hasMeetingEnded(endsAt), recheck };
}
