import { useState, useEffect } from "react";
import { SupabaseConfig, UserSession } from "../types";
import LordIcon from "./LordIcon";
import { LogOut, LogIn, Shield, User, Tag, Menu, X } from "lucide-react";

interface HeaderProps {
  searchTerm: string;
  onSearchChange: (val: string) => void;
  supabaseConfig: SupabaseConfig | null;
  onOpenSupabaseModal: () => void;
  onOpenAddEventModal: () => void;
  onOpenGroupManagerModal: () => void;
  totalEvents: number;
  user: UserSession | null;
  isAuthLoading: boolean;
  canCreateEvent: boolean;
  canManageGroups: boolean;
  onOpenLoginModal: () => void;
  onLogout: () => void;
}

export default function Header({
  searchTerm,
  onSearchChange,
  supabaseConfig,
  onOpenSupabaseModal,
  onOpenAddEventModal,
  onOpenGroupManagerModal,
  totalEvents,
  user,
  isAuthLoading,
  canCreateEvent,
  canManageGroups,
  onOpenLoginModal,
  onLogout,
}: HeaderProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      if (currentScrollY > lastScrollY && currentScrollY > 50) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  // Current Thai Date format
  const getThaiDateStr = () => {
    const months = [
      "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
      "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
    ];
    const now = new Date();
    const day = now.getDate();
    const month = months[now.getMonth()];
    const year = now.getFullYear() + 543; // Buddhist Era
    return `วันปัจจุบัน: วันที่ ${day} ${month} พ.ศ. ${year}`;
  };

  return (
    <header className={`bg-white border-b border-slate-100 sticky top-0 z-40 backdrop-blur-md bg-white/90 transition-transform duration-300 ${isVisible ? "translate-y-0" : "-translate-y-full"}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          
          {/* Logo & Title */}
          <div className="flex items-start sm:items-center gap-3 sm:gap-3.5">
            <div className="p-1.5 sm:p-2 bg-red-50 rounded-2xl flex items-center justify-center shrink-0 border border-red-100 mt-0.5 sm:mt-0">
              <LordIcon 
                src="https://cdn.lordicon.com/qvyppzqz.json" 
                colors="primary:#dc2626,secondary:#f87171" 
                size={34} 
                trigger="loop" 
              />
            </div>
            <div className="flex flex-col gap-1 sm:gap-0 w-full min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2.5">
                <h1 className="text-[13px] sm:text-base md:text-xl font-bold tracking-tight font-sans text-slate-900 leading-tight">
                  ปฏิทินสำนักงานคณะกรรมการควบคุมเครื่องดื่มแอลกฮอล์
                </h1>
                
                {/* Connection Status Badge */}
                <button
                  id="header-supabase-status-badge"
                  onClick={onOpenSupabaseModal}
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] md:text-[11px] font-semibold cursor-pointer transition-all hover:opacity-90 w-fit ${
                    supabaseConfig 
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                      : "bg-amber-50 text-amber-700 border border-amber-100"
                  }`}
                  title={supabaseConfig ? "เชื่อมต่อกับ Supabase สำเร็จ" : "ใช้งานระบบจำลองเก็บข้อมูลในเบราว์เซอร์"}
                >
                  {supabaseConfig ? (
                    <>
                      <LordIcon 
                        src="https://cdn.lordicon.com/ujgkowid.json" 
                        colors="primary:#10b981,secondary:#059669" 
                        size={12} 
                        trigger="loop" 
                      />
                      <span>Supabase Live</span>
                    </>
                  ) : (
                    <>
                      <LordIcon 
                        src="https://cdn.lordicon.com/ujgkowid.json" 
                        colors="primary:#d97706,secondary:#fbbf24" 
                        size={12} 
                        trigger="loop" 
                      />
                      <span>Local DB</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-[10px] md:text-xs text-slate-500 font-sans mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="hidden md:inline">ระบบรวมตารางงานประชุมและประสานงานกลุ่มงานต่าง ๆ</span>
                <span className="hidden md:inline text-slate-200">|</span>
                <span className="text-slate-600 font-medium">{getThaiDateStr()}</span>
              </p>
            </div>
          </div>

          {/* Quick Actions (Desktop & Mobile) */}
          <div className="flex items-center justify-end w-full lg:w-auto relative">
            
            {/* Desktop View */}
            <div className="hidden lg:flex flex-wrap items-center gap-2">
              {/* User Session Badge & Logout */}
              {user ? (
                <div className="flex items-center gap-2 shrink-0">
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
                    user.role === "admin"
                      ? "bg-indigo-50/50 border-indigo-200 text-indigo-700"
                      : "bg-emerald-50/50 border-emerald-200 text-emerald-700"
                  }`}>
                    {user.role === "admin" ? (
                      <Shield className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    ) : (
                      <User className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    )}
                    <span className="font-sans font-bold whitespace-nowrap">{user.name}</span>
                  </div>
                  
                  <button
                    id="header-logout-btn-desktop"
                    type="button"
                    onClick={onLogout}
                    className="flex items-center justify-center gap-1 px-2.5 py-1.5 border border-slate-200 hover:border-red-200 hover:bg-red-50 hover:text-red-600 rounded-xl text-slate-500 text-xs font-bold transition-all cursor-pointer shrink-0"
                    title="ออกจากระบบ"
                  >
                    <LogOut className="w-3.5 h-3.5 shrink-0" />
                    <span className="font-sans whitespace-nowrap">ออก</span>
                  </button>
                </div>
              ) : supabaseConfig ? (
                <button
                  id="header-login-btn-desktop"
                  type="button"
                  onClick={onOpenLoginModal}
                  className="flex items-center justify-center gap-1.5 px-3.5 py-2 border border-slate-200 hover:border-slate-300 rounded-xl bg-slate-50 hover:bg-white text-slate-700 text-xs font-bold transition-all cursor-pointer shadow-sm transform hover:-translate-y-0.5 shrink-0"
                >
                  <LogIn className="w-4 h-4 text-red-600 shrink-0" />
                  <span className="font-sans text-red-600 whitespace-nowrap">เข้าสู่ระบบ</span>
                </button>
              ) : null}

              {isAuthLoading && (
                <span className="text-xs font-bold text-slate-400 px-2">กำลังตรวจสอบผู้ใช้...</span>
              )}

              {/* Database settings trigger */}
              <button
                id="open-database-settings-btn-desktop"
                type="button"
                onClick={onOpenSupabaseModal}
                className="flex items-center justify-center gap-1.5 px-3 py-2 border border-slate-200 hover:border-slate-300 rounded-xl bg-white text-slate-700 text-xs font-semibold transition-all cursor-pointer shadow-sm hover:bg-slate-50 shrink-0"
              >
                <LordIcon 
                  src="https://cdn.lordicon.com/gsqwyapq.json" 
                  colors="primary:#475569,secondary:#64748b" 
                  size={16} 
                  trigger="hover" 
                />
                <span className="font-sans whitespace-nowrap">ตั้งค่าฐานข้อมูล</span>
              </button>

              <button
                onClick={onOpenGroupManagerModal}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 border rounded-xl bg-white text-xs font-semibold transition-all cursor-pointer shadow-sm hover:bg-slate-50 shrink-0 ${
                  canManageGroups
                    ? "border-slate-200 hover:border-slate-300 text-slate-700"
                    : "border-slate-200 text-slate-400 hover:border-indigo-200"
                }`}
                title={canManageGroups ? "จัดการกลุ่มงาน/กองสังกัด" : "ต้องเข้าสู่ระบบ Supabase Auth จึงจะแก้ไขกลุ่มงานได้"}
              >
                <Tag className={`w-4 h-4 shrink-0 ${canManageGroups ? "text-indigo-600" : "text-slate-400"}`} />
                <span className={`font-sans whitespace-nowrap ${canManageGroups ? "text-indigo-600" : "text-slate-500"}`}>
                  จัดการกลุ่ม
                </span>
              </button>

              {/* Create new event button (Only visible to logged in users) */}
              {canCreateEvent && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    id="open-add-event-btn-desktop"
                    type="button"
                    onClick={onOpenAddEventModal}
                    className="flex items-center justify-center gap-1.5 px-3.5 py-2 border border-transparent rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-all shadow-sm shadow-red-600/10 cursor-pointer transform hover:-translate-y-0.5 animate-fade-in shrink-0"
                  >
                    <LordIcon 
                      src="https://cdn.lordicon.com/pdsourgq.json" 
                      colors="primary:#ffffff,secondary:#ffffff" 
                      size={16} 
                      trigger="hover" 
                    />
                    <span className="font-sans whitespace-nowrap">เพิ่มกิจกรรม</span>
                  </button>
                </div>
              )}
            </div>

            {/* Mobile View Toggle */}
            <div className="flex lg:hidden w-full justify-end">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-1.5 sm:p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors shadow-sm"
              >
                {isMobileMenuOpen ? <X className="w-5 h-5 sm:w-6 sm:h-6" /> : <Menu className="w-5 h-5 sm:w-6 sm:h-6" />}
              </button>
            </div>

            {/* Mobile Dropdown Menu */}
            {isMobileMenuOpen && (
              <div className="absolute top-[120%] right-0 min-w-[240px] bg-white border border-slate-100 rounded-2xl shadow-xl z-50 flex flex-col p-3 gap-2 lg:hidden animate-fade-in">
                
                {user ? (
                  <div className="flex flex-col gap-2 border-b border-slate-100 pb-2 mb-1">
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold w-full ${
                      user.role === "admin"
                        ? "bg-indigo-50/50 border-indigo-200 text-indigo-700"
                        : "bg-emerald-50/50 border-emerald-200 text-emerald-700"
                    }`}>
                      {user.role === "admin" ? (
                        <Shield className="w-4 h-4 text-indigo-500 shrink-0" />
                      ) : (
                        <User className="w-4 h-4 text-emerald-500 shrink-0" />
                      )}
                      <span className="font-sans font-bold truncate">{user.name}</span>
                    </div>
                  </div>
                ) : supabaseConfig ? (
                  <div className="border-b border-slate-100 pb-2 mb-1">
                    <button
                      id="header-login-btn-mobile"
                      type="button"
                      onClick={() => { onOpenLoginModal(); setIsMobileMenuOpen(false); }}
                      className="flex items-center gap-2 w-full px-3 py-2 border border-slate-200 hover:border-slate-300 rounded-xl bg-slate-50 text-slate-700 text-sm font-bold transition-all"
                    >
                      <LogIn className="w-4 h-4 text-red-600 shrink-0" />
                      <span className="font-sans text-red-600">เข้าสู่ระบบ</span>
                    </button>
                  </div>
                ) : null}

                <button
                  onClick={() => { onOpenGroupManagerModal(); setIsMobileMenuOpen(false); }}
                  className={`flex items-center gap-2 w-full px-3 py-2 border rounded-xl bg-white text-sm font-semibold transition-all hover:bg-slate-50 ${
                    canManageGroups
                      ? "border-slate-200 hover:border-slate-300 text-slate-700"
                      : "border-slate-200 hover:border-indigo-200 text-slate-500"
                  }`}
                >
                  <Tag className={`w-4 h-4 shrink-0 ${canManageGroups ? "text-indigo-600" : "text-slate-400"}`} />
                  <span className={`font-sans ${canManageGroups ? "text-indigo-600" : "text-slate-500"}`}>
                    จัดการกลุ่ม
                  </span>
                </button>

                {canCreateEvent && (
                  <>
                    <button
                      id="open-add-event-btn-mobile"
                      type="button"
                      onClick={() => { onOpenAddEventModal(); setIsMobileMenuOpen(false); }}
                      className="flex items-center gap-2 w-full px-3 py-2 border border-transparent rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-all shadow-sm shadow-red-600/10"
                    >
                      <LordIcon 
                        src="https://cdn.lordicon.com/pdsourgq.json" 
                        colors="primary:#ffffff,secondary:#ffffff" 
                        size={18} 
                        trigger="hover" 
                      />
                      <span className="font-sans">เพิ่มกิจกรรม</span>
                    </button>
                  </>
                )}

                <button
                  id="open-database-settings-btn-mobile"
                  type="button"
                  onClick={() => { onOpenSupabaseModal(); setIsMobileMenuOpen(false); }}
                  className="flex items-center gap-2 w-full px-3 py-2 border border-slate-200 hover:border-slate-300 rounded-xl bg-white text-slate-700 text-sm font-semibold transition-all hover:bg-slate-50"
                >
                  <LordIcon 
                    src="https://cdn.lordicon.com/gsqwyapq.json" 
                    colors="primary:#475569,secondary:#64748b" 
                    size={18} 
                    trigger="hover" 
                  />
                  <span className="font-sans">ตั้งค่าฐานข้อมูล</span>
                </button>

                {user && (
                  <button
                    id="header-logout-btn-mobile"
                    type="button"
                    onClick={() => { onLogout(); setIsMobileMenuOpen(false); }}
                    className="flex items-center gap-2 w-full mt-1 px-3 py-2 border border-slate-200 hover:border-red-200 hover:bg-red-50 hover:text-red-600 rounded-xl text-slate-500 text-sm font-bold transition-all"
                  >
                    <LogOut className="w-4 h-4 shrink-0" />
                    <span className="font-sans">ออกจากระบบ</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Search Bar & Summary Stats Row */}
        <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Dynamic Event count */}
          <div className="text-[11px] md:text-xs text-slate-500 font-sans flex items-center gap-1.5 bg-slate-50 py-1 px-2.5 rounded-lg border border-slate-100 w-fit">
            <LordIcon 
              src="https://cdn.lordicon.com/nocovwne.json" 
              colors="primary:#64748b,secondary:#475569" 
              size={14} 
              trigger="hover" 
            />
            <span>มีกิจกรรมทั้งหมดในระบบ: <strong className="text-slate-800 font-bold">{totalEvents}</strong> กิจกรรม</span>
          </div>

          {/* Text Search Input */}
          <div className="relative w-full md:w-72 shrink-0">
            <div className="absolute left-3 top-2 pointer-events-none">
              <LordIcon 
                src="https://cdn.lordicon.com/msoeawqm.json" 
                colors="primary:#64748b,secondary:#94a3b8" 
                size={16} 
                trigger="hover" 
              />
            </div>
            <input
              id="search-event-input"
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="ค้นหากิจกรรมการประชุม..."
              className="w-full text-[11px] md:text-xs pl-9 pr-4 py-1.5 md:py-1.5 border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-500 text-slate-800 transition-all placeholder:text-slate-400"
            />
          </div>
        </div>
      </div>
    </header>
  );
}
