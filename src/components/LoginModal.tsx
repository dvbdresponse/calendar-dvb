import React, { useState } from "react";
import { X, Lock, User, Shield, AlertCircle, Sparkles, KeyRound } from "lucide-react";
import { UserSession } from "../types";
import LordIcon from "./LordIcon";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (session: UserSession) => void;
}

export default function LoginModal({ isOpen, onClose, onLoginSuccess }: LoginModalProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    // Simulate database network delay
    setTimeout(() => {
      if (!username.trim() || !password.trim()) {
        setError("กรุณากรอกชื่อผู้ใช้และรหัสผ่าน");
        setIsLoading(false);
        return;
      }

      // Hardcoded sample accounts for Gov office simulation
      if (username === "admin" && password === "password") {
        onLoginSuccess({
          username: "admin",
          role: "admin",
          name: "ผู้ดูแลระบบกลาง (Admin)"
        });
        setIsLoading(false);
        onClose();
      } else {
        setError("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง (บัญชีจำลอง: admin/password)");
        setIsLoading(false);
      }
    }, 600);
  };

  const handleQuickLogin = (role: "admin") => {
    setUsername(role);
    setPassword("password");
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto font-sans">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Wrapper */}
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="relative w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 transition-all">
          
          {/* Close button */}
          <button
            id="close-login-modal-btn"
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-50 transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Icon Header */}
          <div className="flex flex-col items-center text-center mt-2 mb-6">
            <div className="p-3 bg-red-50 text-red-600 rounded-2xl mb-3 border border-red-100">
              <LordIcon 
                src="https://cdn.lordicon.com/lyvznjgu.json" 
                colors="primary:#dc2626,secondary:#f87171" 
                size={40} 
                trigger="loop" 
              />
            </div>
            <h3 className="text-base font-bold text-slate-800">
              เข้าสู่ระบบบริหารจัดการปฏิทินงาน
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
              สำหรับเจ้าหน้าที่ควบคุมเครื่องดื่มแอลกอฮอล์เพื่อเพิ่ม แก้ไข หรือลบวาระงานประชุม
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            
            {/* Username Input */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                ชื่อผู้ใช้งาน (Username)
              </label>
              <div className="relative">
                <div className="absolute left-3 top-2.5 text-slate-400 pointer-events-none">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="login-username-input"
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setError(null);
                  }}
                  placeholder="เช่น admin"
                  className="w-full text-xs pl-9 pr-4 py-2 border border-slate-200 rounded-xl bg-slate-50/30 hover:bg-slate-50/80 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-500 text-slate-800 transition-all"
                  required
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                รหัสผ่าน (Password)
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
                  placeholder="กรอกรหัสผ่าน"
                  className="w-full text-xs pl-9 pr-4 py-2 border border-slate-200 rounded-xl bg-slate-50/30 hover:bg-slate-50/80 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-500 text-slate-800 transition-all"
                  required
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2.5 text-red-700 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit Button */}
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

          {/* Quick simulation accounts (Aesthetic & Highly functional) */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <div className="flex items-center gap-1 mb-2.5 text-slate-500">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-[10px] font-bold uppercase tracking-wider">บัญชีจำลองผู้ใช้งานพิเศษ (Quick Logins)</span>
            </div>
            <div className="grid grid-cols-1 gap-2">
              <button
                id="quick-login-admin-btn"
                type="button"
                onClick={() => handleQuickLogin("admin")}
                className="flex items-center gap-2 p-2 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-white text-left text-xs text-slate-700 transition-all cursor-pointer"
              >
                <Shield className="w-4 h-4 text-indigo-500 shrink-0" />
                <div className="min-w-0">
                  <p className="font-bold text-[10px] text-slate-800 leading-tight">Admin (ผู้ดูแลระบบ)</p>
                  <p className="text-[9px] text-slate-400 truncate">admin / password</p>
                </div>
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
