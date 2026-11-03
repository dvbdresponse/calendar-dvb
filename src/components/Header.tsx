import { useState, useEffect, useRef } from "react";
import { SupabaseConfig, UserSession } from "../types";
import { LogOut, LogIn, Tag, Menu, X, Plus, Search, CalendarDays, BarChart3 } from "lucide-react";
import BeeIcon from "./BeeIcon";

type AppTab = "calendar" | "analytics";

interface HeaderProps {
  searchTerm: string;
  onSearchChange: (val: string) => void;
  supabaseConfig: SupabaseConfig | null;
  onOpenAddEventModal: () => void;
  onOpenGroupManagerModal: () => void;
  totalEvents: number;
  user: UserSession | null;
  isAuthLoading: boolean;
  canCreateEvent: boolean;
  canManageGroups: boolean;
  onOpenLoginModal: () => void;
  onLogout: () => void;
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
}

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];
const THAI_DAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

const getThaiDateStr = () => {
  const now = new Date();
  return `วัน${THAI_DAYS[now.getDay()]}ที่ ${now.getDate()} ${THAI_MONTHS[now.getMonth()]} ${now.getFullYear() + 543}`;
};

const TABS: { id: AppTab; label: string; icon: typeof CalendarDays }[] = [
  { id: "calendar", label: "ปฏิทิน", icon: CalendarDays },
  { id: "analytics", label: "สถิติ", icon: BarChart3 },
];

function TabSwitcher({ activeTab, onTabChange, className = "", idSuffix = "" }: { activeTab: AppTab; onTabChange: (tab: AppTab) => void; className?: string; idSuffix?: string }) {
  return (
    <nav aria-label="มุมมองหลัก" className={`flex items-center rounded-xl bg-slate-100 p-1 ${className}`}>
      {TABS.map(({ id, label, icon: Icon }) => {
        const isActive = activeTab === id;
        return (
          <button
            key={id}
            id={`tab-${id}${idSuffix}-btn`}
            type="button"
            aria-pressed={isActive}
            onClick={() => onTabChange(id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all ${
              isActive ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Icon className={`h-4 w-4 ${isActive ? "text-red-600" : ""}`} aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </nav>
  );
}

function SearchField({ id, value, onChange, className = "" }: { id: string; value: string; onChange: (val: string) => void; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <label htmlFor={id} className="sr-only">ค้นหากิจกรรมการประชุม</label>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="ค้นหากิจกรรม สถานที่ ผู้บันทึก..."
        className="min-h-10 w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-9 text-base text-slate-800 transition-all placeholder:text-slate-400 hover:border-slate-300 focus:border-red-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-red-100 sm:text-sm"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="ล้างคำค้นหา"
          className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-700"
          style={{ minHeight: "1.75rem" }}
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export default function Header({
  searchTerm,
  onSearchChange,
  supabaseConfig,
  onOpenAddEventModal,
  onOpenGroupManagerModal,
  totalEvents,
  user,
  isAuthLoading,
  canCreateEvent,
  canManageGroups,
  onOpenLoginModal,
  onLogout,
  activeTab,
  onTabChange,
}: HeaderProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

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

  const userInitial = user?.name?.trim().charAt(0) || "U";

  return (
    <header className="app-header sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur-lg supports-[backdrop-filter]:bg-white/70">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-3 lg:flex-none">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 ring-1 ring-amber-200/70">
            <BeeIcon />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold leading-tight text-slate-900 sm:text-base">
              ปฏิทินกองโรคติดต่อนำโดยแมลง
            </h1>
            <p className="truncate text-xs text-slate-500">
              {getThaiDateStr()}
              <span className="hidden sm:inline"> · {totalEvents} กิจกรรมในระบบ</span>
            </p>
          </div>
        </div>

        <TabSwitcher activeTab={activeTab} onTabChange={onTabChange} className="ml-2 hidden md:flex" />

        <div className="hidden flex-1 justify-end lg:flex">
          <SearchField id="search-event-input" value={searchTerm} onChange={onSearchChange} className="w-full max-w-xs" />
        </div>

        <div ref={actionsRef} className="relative flex shrink-0 items-center gap-2">
          <div className="hidden items-center gap-2 lg:flex">
            {isAuthLoading && <span className="text-xs text-slate-500">กำลังตรวจสอบ...</span>}

            <button
              type="button"
              onClick={onOpenGroupManagerModal}
              title={canManageGroups ? "จัดการกลุ่มงาน/กองสังกัด" : "เข้าสู่ระบบเพื่อจัดการกลุ่มงาน"}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <Tag className="h-4 w-4" aria-hidden="true" />
              จัดการกลุ่ม
            </button>

            {canCreateEvent && (
              <button
                id="open-add-event-btn-desktop"
                type="button"
                onClick={onOpenAddEventModal}
                className="flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-red-600/20 transition-all hover:bg-red-700 active:scale-[0.98]"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                เพิ่มกิจกรรม
              </button>
            )}

            {user ? (
              <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white py-1 pl-1 pr-1">
                <span
                  aria-hidden="true"
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-semibold ${
                    user.role === "admin" ? "bg-indigo-100 text-indigo-700" : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {userInitial}
                </span>
                <span title={user.name} className="max-w-36 truncate px-1.5 text-sm font-medium text-slate-700">{user.name}</span>
                <button
                  id="header-logout-btn-desktop"
                  type="button"
                  onClick={onLogout}
                  title="ออกจากระบบ"
                  aria-label="ออกจากระบบ"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
                  style={{ minHeight: "2rem", minWidth: "2rem" }}
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ) : supabaseConfig ? (
              <button
                id="header-login-btn-desktop"
                type="button"
                onClick={onOpenLoginModal}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
              >
                <LogIn className="h-4 w-4 text-red-600" aria-hidden="true" />
                เข้าสู่ระบบ
              </button>
            ) : null}
          </div>

          {canCreateEvent && (
            <button
              id="open-add-event-btn-mobile"
              type="button"
              onClick={onOpenAddEventModal}
              aria-label="เพิ่มกิจกรรม"
              className="flex items-center justify-center rounded-xl bg-red-600 text-white shadow-sm shadow-red-600/20 hover:bg-red-700 lg:hidden"
            >
              <Plus className="h-5 w-5" aria-hidden="true" />
            </button>
          )}

          <button
            ref={menuButtonRef}
            data-modal-return-focus
            type="button"
            aria-label={isMobileMenuOpen ? "ปิดเมนู" : "เปิดเมนู"}
            aria-expanded={isMobileMenuOpen}
            aria-controls="header-mobile-menu"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50 lg:hidden"
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          {isMobileMenuOpen && (
            <div
              id="header-mobile-menu"
              className="absolute right-0 top-full z-50 mt-2 flex w-64 max-w-[calc(100vw-2rem)] flex-col gap-1 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/10 lg:hidden"
            >
              {user && (
                <div className="mb-1 flex items-center gap-2.5 border-b border-slate-100 px-2 pb-3 pt-1">
                  <span
                    aria-hidden="true"
                    className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-semibold ${
                      user.role === "admin" ? "bg-indigo-100 text-indigo-700" : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {userInitial}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{user.name}</p>
                    <p className="text-xs text-slate-500">{user.role === "admin" ? "ผู้ดูแลระบบ" : "เจ้าหน้าที่"}</p>
                  </div>
                </div>
              )}

              {!user && supabaseConfig && (
                <button
                  id="header-login-btn-mobile"
                  type="button"
                  onClick={() => { onOpenLoginModal(); setIsMobileMenuOpen(false); }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                >
                  <LogIn className="h-4 w-4" aria-hidden="true" />
                  เข้าสู่ระบบ
                </button>
              )}

              <button
                type="button"
                onClick={() => { onOpenGroupManagerModal(); setIsMobileMenuOpen(false); }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                <Tag className="h-4 w-4 text-slate-500" aria-hidden="true" />
                จัดการกลุ่มงาน
              </button>

              {user && (
                <button
                  id="header-logout-btn-mobile"
                  type="button"
                  onClick={() => { onLogout(); setIsMobileMenuOpen(false); }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-700"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  ออกจากระบบ
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 pb-3 sm:px-6 md:flex-row md:items-center lg:hidden">
        <TabSwitcher activeTab={activeTab} onTabChange={onTabChange} className="md:hidden" idSuffix="-mobile" />
        <SearchField id="search-event-input-mobile" value={searchTerm} onChange={onSearchChange} className="w-full" />
      </div>
    </header>
  );
}
