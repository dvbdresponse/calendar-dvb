import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  LoaderCircle,
  RotateCw,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import { SupabaseConfig } from "../types";
import { useModalAccessibility } from "../hooks/useModalAccessibility";
import {
  getParticipantPdfUrl,
  PARTICIPANT_PDF_FILENAME,
} from "../utils/participantPdf";
import {
  getExternalPdfUrl,
  getPdfDownloadUrl,
  isLineBrowser,
} from "../utils/pdfLinks";

interface Props {
  path: string;
  config: SupabaseConfig | null;
  onClose: () => void;
}

const controlClass =
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40";

export default function ParticipantPdfViewer({ path, config, onClose }: Props) {
  const dialogRef = useModalAccessibility(true, onClose);
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [retry, setRetry] = useState(0);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [width, setWidth] = useState(0);
  const [pageText, setPageText] = useState("");
  const inLine = isLineBrowser(navigator.userAgent);
  const externalUrl = url ? getExternalPdfUrl(url) : null;

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const measure = () => setWidth(Math.max(1, viewport.clientWidth - 32));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let disposed = false;
    let timedOut = false;
    let fileUrl = "";
    let task: ReturnType<typeof import("pdfjs-dist").getDocument> | undefined;
    setPdf(null);
    setUrl("");
    setError("");
    setLoading(true);
    setPage(1);
    setZoom(1);
    const timeout = window.setTimeout(() => {
      timedOut = true;
      void task?.destroy();
      setLoading(false);
      setError("โหลด PDF นานเกินไป กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง");
    }, 45_000);
    const load = async () => {
      try {
        fileUrl = await getParticipantPdfUrl(path, config);
        if (disposed || timedOut) return;
        setUrl(fileUrl);
        // The legacy build includes compatibility polyfills for mobile webviews.
        const { getDocument, GlobalWorkerOptions } =
          await import("pdfjs-dist/legacy/build/pdf.mjs");
        if (disposed || timedOut) return;
        GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
        const assets = `${import.meta.env.BASE_URL}pdfjs/`;
        task = getDocument({
          url: fileUrl,
          cMapUrl: `${assets}cmaps/`,
          cMapPacked: true,
          standardFontDataUrl: `${assets}standard_fonts/`,
          wasmUrl: `${assets}wasm/`,
          iccUrl: `${assets}iccs/`,
        });
        const document = await task.promise;
        if (disposed || timedOut) return;
        setPdf(document);
        setLoading(false);
      } catch (cause) {
        if (disposed || timedOut) return;
        const failure = cause as Error;
        setError(
          failure.name === "PasswordException"
            ? "ไฟล์นี้มีรหัสผ่าน กรุณาดาวน์โหลดแล้วเปิดด้วยแอปอ่าน PDF"
            : failure.name === "InvalidPDFException"
              ? "ไฟล์ PDF เสียหายหรืออ่านไม่ได้ กรุณาแจ้งผู้แนบไฟล์ให้อัปโหลดใหม่"
              : failure.message?.startsWith("ยังเปิดไฟล์") ||
                  failure.message?.startsWith("ไม่พบไฟล์")
                ? failure.message
                : "เปิด PDF ไม่สำเร็จ กรุณาลองอีกครั้ง หรือเปิดด้วยเบราว์เซอร์ภายนอก",
        );
        setLoading(false);
      } finally {
        clearTimeout(timeout);
        if ((disposed || timedOut) && fileUrl.startsWith("blob:"))
          URL.revokeObjectURL(fileUrl);
      }
    };
    void load();
    return () => {
      disposed = true;
      clearTimeout(timeout);
      void task?.destroy();
      if (fileUrl.startsWith("blob:")) URL.revokeObjectURL(fileUrl);
    };
  }, [path, config, retry]);

  useEffect(() => {
    const host = canvasHostRef.current;
    if (!pdf || !width || !host) return;
    let disposed = false;
    let task: RenderTask | undefined;
    setRendering(true);
    setPageText("");
    setError("");
    const render = async () => {
      try {
        const pdfPage = await pdf.getPage(page);
        if (disposed) return;
        const natural = pdfPage.getViewport({ scale: 1 });
        const viewport = pdfPage.getViewport({
          scale: (width / natural.width) * zoom,
        });
        const ratio = Math.min(
          window.devicePixelRatio || 1,
          2,
          4096 / Math.max(viewport.width, viewport.height),
        );
        // A fresh canvas keeps a cancelled render from racing the next page.
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.floor(viewport.width * ratio));
        canvas.height = Math.max(1, Math.floor(viewport.height * ratio));
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        canvas.style.display = "block";
        canvas.setAttribute("aria-hidden", "true");
        host.replaceChildren(canvas);
        task = pdfPage.render({
          canvas,
          viewport,
          transform: [ratio, 0, 0, ratio, 0, 0],
        });
        await task.promise;
        if (disposed) return;
        setRendering(false);
        // Text extraction is an accessibility enhancement; a failure must not
        // hide a page that has already rendered successfully.
        const text = await pdfPage.getTextContent().catch(() => null);
        if (!disposed)
          setPageText(
            text?.items
              .map((item) => ("str" in item ? item.str : ""))
              .join(" ") || "",
          );
      } catch (cause) {
        if (disposed || (cause as Error).name === "RenderingCancelledException")
          return;
        setRendering(false);
        setError(
          "แสดงหน้านี้ไม่ได้ กรุณาลองอีกครั้ง หรือดาวน์โหลดเพื่อเปิดด้วยแอปอ่าน PDF",
        );
      }
    };
    void render();
    return () => {
      disposed = true;
      task?.cancel();
    };
  }, [pdf, page, width, zoom]);

  const changePage = (next: number) => {
    setPage(next);
    viewportRef.current?.scrollTo(0, 0);
  };

  return (
    <div className="fixed inset-0 z-[180] flex items-center justify-center bg-slate-950/60 sm:p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="participant-pdf-title"
        tabIndex={-1}
        className="flex h-dvh w-full min-w-0 flex-col overflow-hidden bg-white font-sans sm:h-[calc(100dvh-2rem)] sm:max-w-5xl sm:rounded-2xl"
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 px-4 py-3">
          <FileText
            aria-hidden="true"
            className="h-5 w-5 shrink-0 text-red-700"
          />
          <h2
            id="participant-pdf-title"
            className="min-w-0 flex-1 text-base font-bold text-slate-900"
          >
            รายชื่อผู้เข้าร่วมประชุม
          </h2>
          <button
            type="button"
            onClick={onClose}
            data-autofocus
            aria-label="ปิดรายชื่อผู้เข้าร่วม"
            className={controlClass}
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </header>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="หน้าก่อนหน้า"
              disabled={!pdf || page <= 1}
              onClick={() => changePage(page - 1)}
              className={controlClass}
            >
              <ChevronLeft aria-hidden="true" className="h-4 w-4" />
            </button>
            <span
              className="min-w-24 text-center text-sm tabular-nums text-slate-700"
              aria-live="polite"
            >
              หน้า {pdf ? page : "–"} / {pdf?.numPages ?? "–"}
            </span>
            <button
              type="button"
              aria-label="หน้าถัดไป"
              disabled={!pdf || page >= pdf.numPages}
              onClick={() => changePage(page + 1)}
              className={controlClass}
            >
              <ChevronRight aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="ย่อ PDF"
              disabled={!pdf || zoom <= 0.75}
              onClick={() => setZoom((value) => Math.max(0.75, value - 0.25))}
              className={controlClass}
            >
              <ZoomOut aria-hidden="true" className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="ปรับ PDF ให้พอดีหน้าจอ"
              disabled={!pdf}
              onClick={() => setZoom(1)}
              className={controlClass}
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              aria-label="ขยาย PDF"
              disabled={!pdf || zoom >= 2}
              onClick={() => setZoom((value) => Math.min(2, value + 0.25))}
              className={controlClass}
            >
              <ZoomIn aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
          {url && (
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={getPdfDownloadUrl(url, PARTICIPANT_PDF_FILENAME)}
                download={PARTICIPANT_PDF_FILENAME}
                className={controlClass}
              >
                <Download aria-hidden="true" className="h-4 w-4" />
                ดาวน์โหลด
              </a>
              {externalUrl && (
                <a href={externalUrl} className={controlClass}>
                  <ExternalLink aria-hidden="true" className="h-4 w-4" />
                  เปิดในเบราว์เซอร์
                </a>
              )}
            </div>
          )}
        </div>
        {inLine && (
          <p className="shrink-0 border-b border-slate-200 bg-slate-50 px-4 py-2 text-sm leading-relaxed text-slate-700">
            ดู PDF ได้ในหน้านี้ หากดาวน์โหลดไม่ได้ ให้เลือก “เปิดในเบราว์เซอร์”
            หรือใช้เมนูของ LINE เพื่อเปิดด้วย Safari / Chrome
          </p>
        )}
        <div
          ref={viewportRef}
          className="relative min-h-0 flex-1 overflow-auto bg-slate-100 p-4"
          tabIndex={0}
          role="region"
          aria-label="เนื้อหา PDF"
          aria-busy={loading || rendering}
        >
          {(loading || rendering) && !error && (
            <div
              role="status"
              className="sticky top-0 z-10 mx-auto mb-3 flex w-fit items-center gap-2 rounded-lg bg-white px-4 py-3 text-sm text-slate-700 shadow-md"
            >
              <LoaderCircle
                aria-hidden="true"
                className="h-4 w-4 animate-spin"
              />
              {loading ? "กำลังโหลดรายชื่อผู้เข้าร่วม…" : "กำลังแสดงหน้า…"}
            </div>
          )}
          {error && (
            <div
              role="alert"
              className="mx-auto my-8 max-w-lg rounded-xl bg-white p-5 text-slate-800"
            >
              <AlertCircle
                aria-hidden="true"
                className="mb-3 h-6 w-6 text-red-700"
              />
              <p className="text-base font-semibold">
                เปิดรายชื่อผู้เข้าร่วมไม่สำเร็จ
              </p>
              <p className="mt-2 text-sm leading-relaxed">{error}</p>
              <button
                type="button"
                onClick={() => setRetry((value) => value + 1)}
                className={`${controlClass} mt-4`}
              >
                <RotateCw aria-hidden="true" className="h-4 w-4" />
                ลองอีกครั้ง
              </button>
            </div>
          )}
          <div
            className={
              error || !pdf ? "hidden" : "mx-auto w-fit bg-white shadow-md"
            }
          >
            <div ref={canvasHostRef} />
            <p className="sr-only" aria-label={`ข้อความ PDF หน้า ${page}`}>
              {pageText}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
