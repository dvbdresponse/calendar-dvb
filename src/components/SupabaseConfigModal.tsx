import { useState, useEffect } from "react";
import { X, Check, Copy, Database, Cloud, Wifi, AlertCircle, RefreshCw, FileText } from "lucide-react";
import { Group, SupabaseConfig } from "../types";
import { buildSqlSchema, checkSupabaseConnection } from "../utils/supabaseClient";
import { buildParticipantPdfSql } from "../utils/participantPdfSchema";

interface SupabaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentConfig: SupabaseConfig | null;
  groups: Group[];
  onSaveConfig: (config: SupabaseConfig | null) => void;
}

export default function SupabaseConfigModal({
  isOpen,
  onClose,
  currentConfig,
  groups,
  onSaveConfig,
}: SupabaseConfigModalProps) {
  const [url, setUrl] = useState(currentConfig?.url || "");
  const [anonKey, setAnonKey] = useState(currentConfig?.anonKey || "");
  const [tableName, setTableName] = useState(currentConfig?.tableName || "events");
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<"none" | "success" | "error">("none");
  const [copied, setCopied] = useState(false);
  const [pdfSqlCopied, setPdfSqlCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const sqlSchema = buildSqlSchema(groups);

  useEffect(() => {
    if (isOpen) {
      setUrl(currentConfig?.url || "");
      setAnonKey(currentConfig?.anonKey || "");
      setTableName(currentConfig?.tableName || "events");
      setTestResult("none");
      setPdfSqlCopied(false);
      setCopyError("");
    }
  }, [isOpen, currentConfig]);

  if (!isOpen) return null;

  const handleTest = async () => {
    if (!url || !anonKey) {
      setTestResult("error");
      return;
    }
    setIsTesting(true);
    setTestResult("none");
    const success = await checkSupabaseConnection(url, anonKey, tableName);
    setIsTesting(false);
    setTestResult(success ? "success" : "error");
  };

  const handleSave = () => {
    if (!url || !anonKey) {
      // Clear config to fallback to local state
      onSaveConfig(null);
      onClose();
      return;
    }
    onSaveConfig({ url, anonKey, tableName });
    onClose();
  };

  const handleClear = () => {
    setUrl("");
    setAnonKey("");
    setTableName("events");
    onSaveConfig(null);
    setTestResult("none");
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlSchema);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyPdfSql = async () => {
    try {
      await navigator.clipboard.writeText(buildParticipantPdfSql(tableName));
      setPdfSqlCopied(true);
      setCopyError("");
    } catch {
      setCopyError("คัดลอกอัตโนมัติไม่ได้ กรุณาเปิดดู SQL แล้วคัดลอกข้อความด้วยตนเอง");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div 
        id="supabase-config-dialog"
        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold font-sans">เชื่อมต่อระบบฐานข้อมูล Supabase</h3>
              <p className="text-xs text-slate-400 font-sans">เชื่อมต่อปฏิทินของคุณเข้ากับเซิร์ฟเวอร์จริงและเปิดใช้งานแบบเรียลไทม์</p>
            </div>
          </div>
          <button 
            id="close-supabase-modal-btn"
            onClick={onClose} 
            className="text-slate-400 hover:text-white transition-colors p-1.5 hover:bg-slate-800 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Intro description */}
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-sm text-slate-600">
            <p className="font-sans leading-relaxed">
              โดยปกติแล้ว ระบบนี้จะจัดเก็บข้อมูลจำลองไว้ในเครื่องคอมพิวเตอร์ของคุณ (<span className="font-semibold text-slate-800">Local Database</span>) 
              คุณสามารถเชื่อมโยงปฏิทินนี้เข้ากับบัญชี <span className="font-semibold text-emerald-600">Supabase</span> เพื่อบันทึกข้อมูลถาวร ใช้ Supabase Auth และควบคุมสิทธิ์ด้วย RLS
            </p>
          </div>

          {/* Connection Form */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Cloud className="w-4 h-4 text-slate-500" />
              การตั้งค่า API credentials
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 block">Supabase Project URL</label>
                <input 
                  type="text" 
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://your-project.supabase.co"
                  className="w-full text-sm px-3.5 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 block">Supabase Anon Key (Public API Key)</label>
                <input 
                  type="password" 
                  value={anonKey}
                  onChange={(e) => setAnonKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="w-full text-sm px-3.5 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 block">ชื่อตาราง (Database Table)</label>
                <input 
                  type="text" 
                  value={tableName}
                  onChange={(e) => setTableName(e.target.value)}
                  placeholder="events"
                  className="w-full text-sm px-3.5 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                />
              </div>

              <div className="flex items-end gap-2 pb-0.5">
                <button
                  id="test-connection-btn"
                  type="button"
                  onClick={handleTest}
                  disabled={isTesting || !url || !anonKey}
                  className="flex-1 text-sm font-medium px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isTesting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      กำลังทดสอบ...
                    </>
                  ) : (
                    <>
                      <Wifi className="w-4 h-4" />
                      ทดสอบการเชื่อมต่อ
                    </>
                  )}
                </button>

                {currentConfig && (
                  <button
                    id="clear-supabase-config-btn"
                    type="button"
                    onClick={handleClear}
                    className="text-xs text-red-600 hover:bg-red-50 px-3 py-2 rounded-xl transition-colors font-medium"
                  >
                    ยกเลิกเชื่อมต่อ
                  </button>
                )}
              </div>
            </div>

            {/* Test result message */}
            {testResult === "success" && (
              <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 p-3 rounded-xl">
                <Check className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>เชื่อมต่อสำเร็จ! สามารถเชื่อมข้อมูลกับระบบได้ทันที</span>
              </div>
            )}
            {testResult === "error" && (
              <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-100 p-3 rounded-xl">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                <div>
                  <p className="font-semibold">เชื่อมต่อไม่สำเร็จ</p>
                  <p className="text-xs text-red-600/90">โปรดตรวจสอบว่า URL และ Anon Key ถูกต้อง และคุณได้สร้างตาราง <code className="bg-red-100 px-1 rounded font-mono">{tableName}</code> ในฐานข้อมูลแล้ว</p>
                </div>
              </div>
            )}
          </div>

          <section className="space-y-3 border-t border-slate-200 pt-5" aria-labelledby="participant-storage-title">
            <h4 id="participant-storage-title" className="text-sm font-semibold text-slate-800">เปิดใช้ไฟล์รายชื่อผู้เข้าร่วมประชุม</h4>
            <p className="text-xs leading-relaxed text-slate-600">สำหรับฐานข้อมูลที่ใช้อยู่: คัดลอก SQL ด้านล่างไปรันใน Supabase SQL Editor หนึ่งครั้ง เพื่อเพิ่มพื้นที่แนบ PDF ส่วนตัว รองรับไฟล์ละไม่เกิน 2 MB</p>
            <button id="copy-participant-pdf-sql-btn" type="button" onClick={handleCopyPdfSql} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-emerald-300 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">
              {pdfSqlCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {pdfSqlCopied ? "คัดลอก SQL สำหรับแนบ PDF แล้ว" : "คัดลอก SQL สำหรับแนบ PDF"}
            </button>
            {copyError && <p role="alert" className="text-xs text-red-700">{copyError}</p>}
            <details className="text-xs text-slate-700">
              <summary className="cursor-pointer py-2 font-medium">ดู SQL สำหรับแนบ PDF</summary>
              <pre className="max-h-48 overflow-auto whitespace-pre rounded-lg bg-slate-900 p-3 text-xs text-slate-100">{buildParticipantPdfSql(tableName)}</pre>
            </details>
          </section>

          {/* SQL Instructions Accordion */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-500" />
                วิธีติดตั้งตารางใน Supabase Console
              </h4>
              <button
                id="copy-sql-schema-btn"
                type="button"
                onClick={handleCopySql}
                className="text-xs font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1.5 py-1 px-2.5 hover:bg-emerald-50 rounded-lg transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    คัดลอกแล้ว!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    คัดลอก SQL Schema
                  </>
                )}
              </button>
            </div>

            <div className="bg-slate-900 text-slate-300 font-mono text-xs rounded-xl overflow-hidden shadow-inner border border-slate-800">
              <div className="px-4 py-2 bg-slate-950 flex items-center justify-between text-slate-400 border-b border-slate-800">
                <span>Database Schema.sql</span>
                <span className="text-[10px] uppercase font-sans tracking-wider bg-slate-800 text-slate-300 px-2 py-0.5 rounded">PostgreSQL</span>
              </div>
              <div className="p-4 max-h-[220px] overflow-y-auto whitespace-pre scrolling-touch leading-relaxed">
                {sqlSchema}
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 leading-relaxed font-sans">
              <p className="font-bold text-amber-900">หากนำเข้าวันหยุดราชการไม่สำเร็จ ให้รัน SQL Schema ล่าสุดนี้ใน Supabase SQL Editor</p>
              <p className="mt-1">ส่วนสำคัญคือ RLS policy สำหรับเพิ่มรายการในตาราง events:</p>
              <code className="mt-2 block bg-white/70 border border-amber-200 rounded-md px-2 py-1 text-[11px] text-amber-900 overflow-x-auto">
                CREATE POLICY "Authenticated users create events" ON public.events FOR INSERT TO authenticated WITH CHECK (true);
              </code>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed font-sans">
              วิธีทำ: รัน SQL นี้ใน Supabase SQL Editor จากนั้นสร้างผู้ใช้ใน Authentication ผู้ที่เข้าสู่ระบบแล้วจะสามารถแก้ไขข้อมูลได้ทันที ส่วนตาราง profiles ใช้เสริมชื่อแสดงผลเท่านั้น
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 shrink-0">
          <button
            id="cancel-supabase-config-btn"
            type="button"
            onClick={onClose}
            className="text-sm px-4 py-2 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-medium transition-colors"
          >
            ปิดหน้าต่าง
          </button>
          <button
            id="save-supabase-config-btn"
            type="button"
            onClick={handleSave}
            className="text-sm px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-md shadow-emerald-600/10 transition-colors"
          >
            บันทึกการเชื่อมต่อ
          </button>
        </div>
      </div>
    </div>
  );
}
