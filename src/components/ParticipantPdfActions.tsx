import { useState } from "react";
import { Download, FileText, LoaderCircle } from "lucide-react";

interface ParticipantPdfActionsProps {
  path: string;
  onOpen: (path: string, download?: boolean) => Promise<void>;
}

export default function ParticipantPdfActions({
  path,
  onOpen,
}: ParticipantPdfActionsProps) {
  const [pending, setPending] = useState<"view" | "download" | null>(null);
  const handleOpen = async (download = false) => {
    if (pending) return;
    setPending(download ? "download" : "view");
    try {
      await onOpen(path, download);
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      <button
        type="button"
        disabled={!!pending}
        onClick={() => handleOpen()}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:opacity-60"
      >
        {pending === "view" ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <FileText className="h-4 w-4" />
        )}
        {pending === "view" ? "กำลังเปิดไฟล์…" : "ดูรายชื่อผู้เข้าร่วม (PDF)"}
      </button>
      <button
        type="button"
        disabled={!!pending}
        onClick={() => handleOpen(true)}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:opacity-60"
      >
        {pending === "download" ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        {pending === "download" ? "กำลังดาวน์โหลด…" : "ดาวน์โหลด"}
      </button>
    </div>
  );
}
