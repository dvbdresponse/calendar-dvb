import React, { useState } from "react";
import { AlertCircle, KeyRound, Lock, Mail, Shield, X } from "lucide-react";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (email: string, password: string) => Promise<void>;
}

const toThaiAuthError = (message: string) => {
  if (message.toLowerCase().includes("invalid login")) {
    return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
  }
  if (message.toLowerCase().includes("email not confirmed")) {
    return "บัญชีนี้ยังไม่ได้ยืนยันอีเมล";
  }
  return message || "เข้าสู่ระบบไม่สำเร็จ";
};

export default function LoginModal({ isOpen, onClose, onLogin }: LoginModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError("กรุณากรอกอีเมลและรหัสผ่าน");
      return;
    }

    try {
      setIsLoading(true);
      await onLogin(email.trim(), password);
      setPassword("");
      onClose();
    } catch (e: any) {
      setError(toThaiAuthError(e.message));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto font-sans">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={onClose} />

      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="relative w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 transition-all">
          <button
            id="close-login-modal-btn"
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-50 transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex flex-col items-center text-center mt-2 mb-6">
            <div className="p-3 bg-red-50 text-red-600 rounded-2xl mb-3 border border-red-100">
              <Shield className="w-10 h-10 text-red-600" />
            </div>
            <h3 className="text-base font-bold text-slate-800">เข้าสู่ระบบด้วย Supabase Auth</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
              ใช้บัญชีที่สร้างใน Supabase Authentication เพื่อเพิ่ม แก้ไข หรือลบข้อมูลในปฏิทิน กองโรคติดต่อนำโดยแมลง
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                อีเมลผู้ใช้งาน
              </label>
              <div className="relative">
                <div className="absolute left-3 top-2.5 text-slate-400 pointer-events-none">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="login-email-input"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError(null);
                  }}
                  placeholder="name@example.go.th"
                  className="w-full text-xs pl-9 pr-4 py-2 border border-slate-200 rounded-xl bg-slate-50/30 hover:bg-slate-50/80 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-500 text-slate-800 transition-all"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                รหัสผ่าน
              </label>
              <div className="relative">
                <div className="absolute left-3 top-2.5 text-slate-400 pointer-events-none">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="login-password-input"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  placeholder="กรอกรหัสผ่าน Supabase"
                  className="w-full text-xs pl-9 pr-4 py-2 border border-slate-200 rounded-xl bg-slate-50/30 hover:bg-slate-50/80 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-500 text-slate-800 transition-all"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2.5 text-red-700 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              id="submit-login-btn"
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md shadow-red-600/10 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>เข้าสู่ระบบ</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100">
            <div className="flex items-start gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-500">
              <Shield className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                ระบบนี้ไม่มีบัญชีจำลองแล้ว ผู้ที่เข้าสู่ระบบผ่าน Supabase Auth จะสามารถแก้ไขข้อมูลได้ตามนโยบาย RLS
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
