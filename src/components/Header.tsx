import { useState, useEffect, useRef } from "react";
import { SupabaseConfig, UserSession } from "../types";
import { LogOut, LogIn, Shield, User, Tag, Menu, X, CalendarDays, Database, Plus, ClipboardList, Search } from "lucide-react";

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let lastScrollY = window.scrollY;
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const headerHasFocus = document.activeElement?.closest("header");
      setIsVisible(!!headerHasFocus || currentScrollY <= lastScrollY || currentScrollY <= 50);
      lastScrollY = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMobileMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    const outsideClick = (event: PointerEvent) => {
      if (!actionsRef.current?.contains(event.target as Node)) setIsMobileMenuOpen(false);
    };
    document.addEventListener("keydown", dismiss);
    document.addEventListener("pointerdown", outsideClick);
    return () => {
      document.removeEventListener("keydown", dismiss);
      document.removeEventListener("pointerdown", outsideClick);
    };
  }, [isMobileMenuOpen]);

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
    <header onFocusCapture={() => setIsVisible(true)} className={`app-header bg-white border-b border-slate-100 sticky top-0 z-40 transition-transform duration-300 ${isVisible ? "translate-y-0" : "-translate-y-full"}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] lg:flex lg:items-center lg:justify-between gap-3">
          
          {/* Logo & Title */}
          <div className="flex items-start sm:items-center gap-3 sm:gap-3.5">
            <div className="p-1.5 sm:p-2 bg-red-50 rounded-2xl flex items-center justify-center shrink-0 border border-red-100 mt-0.5 sm:mt-0">
              <CalendarDays className="w-8 h-8 text-red-600" />
            </div>
            <div className="flex flex-col gap-1 sm:gap-0 w-full min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2.5">
                <h1 className="text-sm sm:text-base md:text-xl font-bold tracking-tight font-sans text-slate-900 leading-snug">
                  ปฏิทิน กองโรคติดต่อนำโดยแมลง
                </h1>
                
                {/* Connection Status Badge */}
                <button
                  id="header-supabase-status-badge"
                  type="button"
                  aria-label={`${supabaseConfig ? "ข้อมูลส่วนกลาง" : "ข้อมูลในเครื่อง"} · เปิดการตั้งค่าการเชื่อมต่อฐานข้อมูล`}
                  onClick={onOpenSupabaseModal}
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold cursor-pointer transition-all hover:opacity-90 w-fit ${
                    supabaseConfig 
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                      : "bg-amber-50 text-amber-700 border border-amber-100"
                  }`}
                  title="เปิดการตั้งค่าการเชื่อมต่อฐานข้อมูล"
                >
                  {supabaseConfig ? (
                    <>
                      <Database className="w-3 h-3 text-emerald-600" />
                      <span>ข้อมูลส่วนกลาง</span>
                    </>
                  ) : (
                    <>
                      <Database className="w-3 h-3 text-amber-600" />
                      <span>ข้อมูลในเครื่อง</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-slate-600 font-sans mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="hidden md:inline">ระบบรวมตารางงานประชุมและประสานงานกลุ่มงานต่าง ๆ</span>
                <span className="hidden md:inline text-slate-200">|</span>
                <span className="text-slate-600 font-medium">{getThaiDateStr()}</span>
              </p>
            </div>
          </div>

          {/* Quick Actions (Desktop & Mobile) */}
          <div ref={actionsRef} className="flex items-center justify-end self-start lg:self-center relative">
            
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
                    <span title={user.name} className="font-sans font-bold truncate max-w-44">{user.name}</span>
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
                <span className="text-xs font-bold text-slate-600 px-2">กำลังตรวจสอบผู้ใช้...</span>
              )}

              <button
                onClick={onOpenGroupManagerModal}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 border rounded-xl bg-white text-xs font-semibold transition-all cursor-pointer shadow-sm hover:bg-slate-50 shrink-0 ${
                  canManageGroups
                    ? "border-slate-200 hover:border-slate-300 text-slate-700"
                    : "border-slate-200 text-slate-600 hover:border-indigo-200"
                }`}
                title={canManageGroups ? "จัดการกลุ่มงาน/กองสังกัด" : "เข้าสู่ระบบเพื่อจัดการกลุ่มงาน"}
              >
                <Tag className={`w-4 h-4 shrink-0 ${canManageGroups ? "text-indigo-600" : "text-slate-600"}`} />
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
                    <Plus className="w-4 h-4 text-white shrink-0" />
                    <span className="font-sans whitespace-nowrap">เพิ่มกิจกรรม</span>
                  </button>
                </div>
              )}
            </div>

            {/* Mobile View Toggle */}
            <div className="flex lg:hidden w-full justify-end">
              <button
                ref={menuButtonRef}
                data-modal-return-focus
                type="button"
                aria-label={isMobileMenuOpen ? "ปิดเมนู" : "เปิดเมนู"}
                aria-expanded={isMobileMenuOpen}
                aria-controls="header-mobile-menu"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-1.5 sm:p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors shadow-sm"
              >
                {isMobileMenuOpen ? <X className="w-5 h-5 sm:w-6 sm:h-6" /> : <Menu className="w-5 h-5 sm:w-6 sm:h-6" />}
              </button>
            </div>

            {/* Mobile Dropdown Menu */}
            {isMobileMenuOpen && (
              <div id="header-mobile-menu" className="absolute top-full mt-2 right-0 w-64 max-w-[calc(100vw-2rem)] bg-white border border-slate-100 rounded-2xl shadow-xl z-50 flex flex-col p-3 gap-2 lg:hidden">
                
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
                  <Tag className={`w-4 h-4 shrink-0 ${canManageGroups ? "text-indigo-600" : "text-slate-600"}`} />
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
                      <Plus className="w-4 h-4 text-white shrink-0" />
                      <span className="font-sans">เพิ่มกิจกรรม</span>
                    </button>
                  </>
                )}

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
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Dynamic Event count */}
          <div className="text-sm text-slate-600 font-sans flex items-center gap-1.5 bg-slate-50 py-1 px-2.5 rounded-lg border border-slate-100 w-fit">
            <ClipboardList className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>มีกิจกรรมทั้งหมดในระบบ: <strong className="text-slate-800 font-bold">{totalEvents}</strong> กิจกรรม</span>
          </div>

          {/* Text Search Input */}
          <div className="relative w-full md:w-72 shrink-0">
            <label htmlFor="search-event-input" className="sr-only">ค้นหากิจกรรมการประชุม</label>
            <div className="absolute left-3 top-3.5 pointer-events-none">
              <Search className="w-4 h-4 text-slate-600" />
            </div>
            <input
              id="search-event-input"
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="ค้นหากิจกรรมการประชุม..."
              className="w-full text-base sm:text-sm min-h-11 pl-9 pr-4 py-2 border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-500 text-slate-800 transition-all placeholder:text-slate-600"
            />
          </div>
        </div>
      </div>
    </header>
  );
}
