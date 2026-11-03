import { Fragment, useState } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Video, Calendar, List, CalendarDays, Filter, Inbox } from "lucide-react";
import { EventData, Group, Holiday } from "../types";
import { getGroupBadgeStyle, getGroupPalette } from "../utils/groupColors";
import CalendarEventCard from "./CalendarEventCard";
import CalendarEventPreview, { CalendarPreview } from "./CalendarEventPreview";

interface UnifiedHoliday {
  name: string;
  id: string;
  created_by?: string;
}

interface CalendarViewProps {
  searchTerm: string;
  onClearSearch: () => void;
  onRequestLogin: () => void;
  events: EventData[];
  groups: Group[];
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (date: string) => void;
  onEditEvent: (event: EventData) => void;
  onDuplicateEvent: (event: EventData) => void;
  onDeleteEvent: (id: string) => void;
  onOpenParticipantPdf: (path: string, download?: boolean) => Promise<void>;
  activeGroupFilters: string[];
  onToggleGroupFilter: (groupId: string) => void;
  onClearFilters: () => void;
  isLoggedIn: boolean;
  canManageEvent?: (event: EventData) => boolean;
}

export default function CalendarView({
  searchTerm,
  onClearSearch,
  onRequestLogin,
  events,
  groups,
  selectedDate,
  onSelectDate,
  onEditEvent,
  onDuplicateEvent,
  onDeleteEvent,
  onOpenParticipantPdf,
  activeGroupFilters,
  onToggleGroupFilter,
  onClearFilters,
  isLoggedIn,
  canManageEvent = () => true,
}: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"calendar" | "agenda">("calendar");
  const [showAgendas, setShowAgendas] = useState(true);
  const [showHolidays, setShowHolidays] = useState(true);
  const [agendaSubTab, setAgendaSubTab] = useState<"meetings" | "holidays">("meetings");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [preview, setPreview] = useState<CalendarPreview | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  const THAI_MONTHS = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
  ];

  // Days of the week header
  const DAYS_SHORT = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
  const DAYS_FULL = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

  // Helper to generate calendar grids
  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay(); // 0 = Sun, 1 = Mon ...

  const totalDays = getDaysInMonth(year, month);
  const firstDayIndex = getFirstDayOfMonth(year, month);

  // Get previous month padding days
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const daysInPrevMonth = getDaysInMonth(prevYear, prevMonth);

  const calendarCells = [];

  // 1. Fill previous month padding days
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const mStr = String(prevMonth + 1).padStart(2, "0");
    const dStr = String(d).padStart(2, "0");
    calendarCells.push({
      dateStr: `${prevYear}-${mStr}-${dStr}`,
      dayNum: d,
      isCurrentMonth: false,
    });
  }

  // 2. Fill current month days
  for (let d = 1; d <= totalDays; d++) {
    const mStr = String(month + 1).padStart(2, "0");
    const dStr = String(d).padStart(2, "0");
    calendarCells.push({
      dateStr: `${year}-${mStr}-${dStr}`,
      dayNum: d,
      isCurrentMonth: true,
    });
  }

  // 3. Fill next month padding days to make perfect grids of 35 or 42
  const totalCellsSoFar = calendarCells.length;
  const remainingCells = totalCellsSoFar <= 35 ? 35 - totalCellsSoFar : 42 - totalCellsSoFar;
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;

  for (let d = 1; d <= remainingCells; d++) {
    const mStr = String(nextMonth + 1).padStart(2, "0");
    const dStr = String(d).padStart(2, "0");
    calendarCells.push({
      dateStr: `${nextYear}-${mStr}-${dStr}`,
      dayNum: d,
      isCurrentMonth: false,
    });
  }

  // Navigation handlers
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleGoToToday = () => {
    const today = new Date();
    setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
    onSelectDate(formatDateString(today));
  };

  const formatDateString = (dateObj: Date): string => {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, "0");
    const d = String(dateObj.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const todayStr = formatDateString(new Date());

  // Helper to check if a date string falls within an event's date range
  const isDateInRange = (event: EventData, targetDate: string) => {
    if (event.end_date) {
      return targetDate >= event.date && targetDate <= event.end_date;
    }
    return event.date === targetDate;
  };

  // Get all holidays for a specific date. Official holidays are seeded into events.
  const getHolidaysForDate = (dateStr: string): UnifiedHoliday[] => {
    if (!showHolidays) return [];
    return events
      .filter(e => isDateInRange(e, dateStr) && e.is_holiday)
      .map(holiday => ({
        id: holiday.id,
        name: holiday.title,
        created_by: holiday.created_by,
      }));
  };

  // Keep for legacy/simple check where only first holiday is needed
  const getHolidayForDate = (dateStr: string): Holiday | undefined => {
    const list = getHolidaysForDate(dateStr);
    if (list.length > 0) {
      return { date: dateStr, name: list[0].name };
    }
    return undefined;
  };

  // Get actual work agendas/meetings for a specific date, considering the group filters and search query
  const getEventsForDate = (dateStr: string): EventData[] => {
    if (!showAgendas) return [];
    return events.filter(e => {
      if (!isDateInRange(e, dateStr)) return false;
      if (e.is_holiday) return false; // Filter out holidays from agendas!
      // Filter out if groups filter is active and group is not matched
      if (activeGroupFilters.length > 0 && !activeGroupFilters.includes(e.group_id)) return false;
      return true;
    }).sort((a, b) => a.start_time.localeCompare(b.start_time));
  };

  // Quick statistical calculation for event counts per group
  const getGroupEventCount = (groupId: string): number => {
    return events.filter(e => e.group_id === groupId && !e.is_holiday).length;
  };

  // Generate all dates in the current month (sorted)
  const getDatesInCurrentMonth = (): string[] => {
    const dates: string[] = [];
    const totalDaysCount = getDaysInMonth(year, month);
    for (let d = 1; d <= totalDaysCount; d++) {
      const mStr = String(month + 1).padStart(2, "0");
      const dStr = String(d).padStart(2, "0");
      dates.push(`${year}-${mStr}-${dStr}`);
    }
    return dates;
  };

  const currentMonthDates = getDatesInCurrentMonth();
  
  // Separated agenda items forMeetings vs Holidays
  const meetingAgendaItems = currentMonthDates.map(dateStr => {
    const dayEvents = getEventsForDate(dateStr);
    return { dateStr, dayEvents };
  }).filter(item => item.dayEvents.length > 0);

  const holidayAgendaItems = currentMonthDates.map(dateStr => {
    const dayHolidays = getHolidaysForDate(dateStr);
    return { dateStr, dayHolidays };
  }).filter(item => item.dayHolidays.length > 0);

  const totalMeetingsCount = new Set(meetingAgendaItems.flatMap(item => item.dayEvents.map(event => event.id))).size;
  const totalHolidaysCount = new Set(holidayAgendaItems.flatMap(item => item.dayHolidays.map(holiday => holiday.id))).size;

  const hasFilters = !!searchTerm.trim() || activeGroupFilters.length > 0;
  const emptyMeetings = (period: "day" | "month") => (
    <div role="status" className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-10 text-center">
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm ring-1 ring-slate-200/70">
        <Inbox className="h-6 w-6" aria-hidden="true" />
      </span>
      <h3 className="text-sm font-semibold text-slate-800">
        {!showAgendas ? "ซ่อนกิจกรรมอยู่" : hasFilters ? "ไม่พบกิจกรรมที่ตรงกับเงื่อนไข" : period === "day" ? "ไม่มีกิจกรรมในวันนี้" : "ไม่มีกิจกรรมในเดือนนี้"}
      </h3>
      <p className="mt-1 max-w-xs text-sm leading-relaxed text-slate-500">
        {!showAgendas ? "เปิดการแสดงวาระงานเพื่อดูรายการประชุม" : hasFilters ? "ลองล้างคำค้นหรือตัวกรองกลุ่มงาน" : isLoggedIn ? "เลือกวันอื่น หรือกดปุ่ม “เพิ่มกิจกรรม” เพื่อบันทึกใหม่" : "เลือกวันอื่น หรือเข้าสู่ระบบเพื่อเพิ่มกิจกรรม"}
      </p>
      {!showAgendas ? (
        <button type="button" onClick={() => setShowAgendas(true)} className="mt-4 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-red-700 shadow-sm ring-1 ring-slate-200 hover:bg-red-50">แสดงวาระงาน</button>
      ) : hasFilters ? (
        <button type="button" onClick={() => { onClearFilters(); onClearSearch(); }} className="mt-4 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-red-700 shadow-sm ring-1 ring-slate-200 hover:bg-red-50">ล้างคำค้นและตัวกรอง</button>
      ) : !isLoggedIn ? (
        <button type="button" onClick={onRequestLogin} className="mt-4 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-red-700 shadow-sm ring-1 ring-slate-200 hover:bg-red-50">เข้าสู่ระบบ</button>
      ) : null}
    </div>
  );

  const MAX_VISIBLE_PILLS = 3;
  const selectedHolidays = getHolidaysForDate(selectedDate);
  const selectedEvents = getEventsForDate(selectedDate);
  const selectedDayIndex = selectedDate ? new Date(`${selectedDate}T00:00:00`).getDay() : 0;
  const isSelectedToday = selectedDate === todayStr;

  const renderDateBadge = (dateStr: string, size: "sm" | "lg" = "sm") => {
    const dateObj = new Date(`${dateStr}T00:00:00`);
    const isToday = dateStr === todayStr;
    return (
      <div
        className={`flex shrink-0 flex-col items-center justify-center rounded-xl ${size === "lg" ? "h-14 w-14" : "h-12 w-12"} ${
          isToday ? "bg-red-600 text-white shadow-sm shadow-red-600/30" : "bg-slate-100 text-slate-700"
        }`}
      >
        <span className={`text-[10px] font-medium leading-none ${isToday ? "text-red-100" : "text-slate-500"}`}>{DAYS_SHORT[dateObj.getDay()]}</span>
        <span className={`${size === "lg" ? "text-xl" : "text-lg"} font-semibold leading-tight`}>{dateObj.getDate()}</span>
      </div>
    );
  };

  const renderHolidayRow = (holiday: UnifiedHoliday) => {
    const originalEvt = events.find((e) => e.id === holiday.id);
    return (
      <div key={holiday.id} className="flex items-start justify-between gap-3 rounded-xl border border-red-100 bg-gradient-to-r from-red-50 to-rose-50/40 p-3.5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-red-600 ring-1 ring-red-100">
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-red-600">วันหยุดราชการ</p>
            <h4 className="text-sm font-semibold leading-snug text-red-950">{holiday.name}</h4>
            <p className="mt-0.5 text-xs text-red-700/70">บันทึกโดย {holiday.created_by || "ระบบ"}</p>
          </div>
        </div>
        {isLoggedIn && originalEvt && canManageEvent(originalEvt) && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => onEditEvent(originalEvt)}
              className="rounded-lg px-2.5 text-xs font-semibold text-slate-600 hover:bg-white hover:text-slate-900"
            >
              แก้ไข
            </button>
            <button
              type="button"
              onClick={() => onDeleteEvent(originalEvt.id)}
              className="rounded-lg px-2.5 text-xs font-semibold text-slate-500 hover:bg-white hover:text-red-700"
            >
              ลบ
            </button>
          </div>
        )}
      </div>
    );
  };

  const toggleChipClass = (active: boolean) =>
    `inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
      active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
    }`;

  return (
    <div className="calendar-surface min-w-0 space-y-4">
      {preview && <CalendarEventPreview preview={preview} onDismiss={() => setPreview(null)} />}

      {/* Toolbar: month navigation, view mode and filters */}
      <section aria-label="เครื่องมือปฏิทิน" className="rounded-2xl border border-slate-200/70 bg-white p-3 shadow-sm shadow-slate-900/[0.03] sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center rounded-xl border border-slate-200 bg-white p-0.5">
              <button
                id="prev-month-btn"
                type="button"
                onClick={handlePrevMonth}
                aria-label="เดือนก่อนหน้า"
                title="เดือนก่อนหน้า"
                className="flex items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                id="today-btn"
                type="button"
                onClick={handleGoToToday}
                className="rounded-lg px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
              >
                วันนี้
              </button>
              <button
                id="next-month-btn"
                type="button"
                onClick={handleNextMonth}
                aria-label="เดือนถัดไป"
                title="เดือนถัดไป"
                className="flex items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-900 sm:text-2xl" aria-live="polite">
              {THAI_MONTHS[month]} <span className="font-normal text-slate-400">{year + 543}</span>
            </h2>
          </div>

          <div className="flex items-center rounded-xl bg-slate-100 p-1">
            <button
              id="view-mode-calendar-btn"
              type="button"
              aria-pressed={viewMode === "calendar"}
              onClick={() => setViewMode("calendar")}
              className={`flex items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-all ${
                viewMode === "calendar" ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Calendar className="h-4 w-4" aria-hidden="true" />
              <span>เดือน</span>
            </button>
            <button
              id="view-mode-agenda-btn"
              type="button"
              aria-pressed={viewMode === "agenda"}
              onClick={() => setViewMode("agenda")}
              className={`flex items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-all ${
                viewMode === "agenda" ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <List className="h-4 w-4" aria-hidden="true" />
              <span>รายการ</span>
              <span className="rounded-full bg-slate-200/80 px-1.5 text-[11px] font-semibold text-slate-700">{totalMeetingsCount}</span>
            </button>
          </div>
        </div>

        <div className="mt-3 border-t border-slate-100 pt-3">
          <button
            id="calendar-filter-toggle"
            type="button"
            aria-expanded={isFilterOpen}
            aria-controls="calendar-filters"
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className="flex w-full items-center justify-between gap-2 text-sm font-medium text-slate-700 md:hidden"
          >
            <span className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-500" aria-hidden="true" />
              ตัวกรอง
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                {activeGroupFilters.length > 0 ? `${activeGroupFilters.length} กลุ่ม` : "ทุกกลุ่มงาน"}
              </span>
            </span>
            <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${isFilterOpen ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>

          <div id="calendar-filters" className={`${isFilterOpen ? "mt-3 flex" : "hidden"} flex-col gap-3 md:mt-0 md:flex lg:flex-row lg:items-start lg:justify-between`}>
            <div className="flex min-w-0 flex-wrap gap-1.5" role="group" aria-label="กรองตามกลุ่มงาน">
              <button
                id="clear-group-filters-btn"
                type="button"
                aria-pressed={activeGroupFilters.length === 0}
                onClick={onClearFilters}
                className={toggleChipClass(activeGroupFilters.length === 0)}
              >
                ทุกกลุ่มงาน
              </button>
              {groups.map((group) => {
                const isActive = activeGroupFilters.includes(group.id);
                const count = getGroupEventCount(group.id);
                const palette = getGroupPalette(group.color);
                return (
                  <button
                    id={`filter-group-${group.id}-btn`}
                    key={group.id}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => onToggleGroupFilter(group.id)}
                    title={group.label}
                    className={`inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                      isActive ? "shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                    }`}
                    style={isActive ? getGroupBadgeStyle(group) : undefined}
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: palette.color }} aria-hidden="true" />
                    <span className="truncate">{group.name}</span>
                    <span className={`rounded-full px-1.5 text-[10px] font-semibold tabular-nums ${isActive ? "bg-white/70" : "bg-slate-100 text-slate-500"}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex shrink-0 flex-wrap gap-1.5 lg:border-l lg:border-slate-100 lg:pl-3" role="group" aria-label="ตัวเลือกการแสดงผล">
              <button id="toggle-show-agendas" type="button" aria-pressed={showAgendas} onClick={() => setShowAgendas(!showAgendas)} className={toggleChipClass(showAgendas)}>
                {showAgendas ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Calendar className="h-3.5 w-3.5" aria-hidden="true" />}
                วาระงาน
              </button>
              <button id="toggle-show-holidays" type="button" aria-pressed={showHolidays} onClick={() => setShowHolidays(!showHolidays)} className={toggleChipClass(showHolidays)}>
                {showHolidays ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />}
                วันหยุดราชการ
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className={viewMode === "calendar" ? "grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_25rem]" : ""}>
        <section aria-label={viewMode === "calendar" ? "ปฏิทินรายเดือน" : "รายการวาระงาน"} className="min-w-0 overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-900/[0.03]">
          {viewMode === "calendar" ? (
            <>
              {/* Desktop/Tablet grid */}
              <div className="hidden sm:block">
                <div className="grid grid-cols-7 border-b border-slate-100 text-center text-xs font-medium text-slate-500">
                  {DAYS_FULL.map((day, idx) => (
                    <div key={day} className={`py-2.5 ${idx === 0 ? "text-red-600" : ""}`}>
                      <span className="lg:hidden">{DAYS_SHORT[idx]}</span>
                      <span className="hidden lg:inline">{day}</span>
                    </div>
                  ))}
                </div>

                <div className="relative z-0 grid grid-cols-7 gap-px bg-slate-100">
                  {calendarCells.map((cell, idx) => {
                    const dayEvents = getEventsForDate(cell.dateStr);
                    const holiday = getHolidayForDate(cell.dateStr);
                    const isSelected = selectedDate === cell.dateStr;
                    const isToday = todayStr === cell.dateStr;
                    const isWeekend = idx % 7 === 0 || idx % 7 === 6;
                    const visibleEvents = dayEvents.slice(0, MAX_VISIBLE_PILLS);
                    const hiddenCount = dayEvents.length - visibleEvents.length;

                    return (
                      <div
                        id={`cell-${cell.dateStr}`}
                        key={`${cell.dateStr}-${idx}`}
                        role="button"
                        tabIndex={0}
                        aria-label={`${formatSelectedDateThaiWithDay(cell.dateStr)}${holiday ? ` · ${holiday.name}` : ""} · ${dayEvents.length} กิจกรรม`}
                        aria-pressed={isSelected}
                        aria-describedby={preview?.date === cell.dateStr ? "calendar-event-preview" : undefined}
                        aria-current={isToday ? "date" : undefined}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onSelectDate(cell.dateStr);
                          }
                        }}
                        onClick={() => onSelectDate(cell.dateStr)}
                        style={{ zIndex: 100 - idx }}
                        className={`group relative flex min-h-[7.5rem] min-w-0 cursor-pointer flex-col p-1.5 transition-colors hover:!z-[150] lg:p-2 ${
                          isSelected
                            ? "bg-red-50/60 ring-2 ring-inset ring-red-500"
                            : holiday && cell.isCurrentMonth
                              ? "bg-red-50/30 hover:bg-red-50/60"
                              : !cell.isCurrentMonth
                                ? "bg-slate-50/80 hover:bg-slate-100/60"
                                : isWeekend
                                  ? "bg-slate-50/40 hover:bg-slate-50"
                                  : "bg-white hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-medium tabular-nums transition-colors ${
                              isToday
                                ? "bg-red-600 font-semibold text-white shadow-sm shadow-red-600/30"
                                : !cell.isCurrentMonth
                                  ? "text-slate-400"
                                  : idx % 7 === 0 || holiday
                                    ? "text-red-600"
                                    : "text-slate-800 group-hover:bg-slate-100"
                            }`}
                          >
                            {cell.dayNum}
                          </span>
                          {holiday && (
                            <span
                              className={`mt-0.5 min-w-0 truncate rounded-md px-1.5 py-0.5 text-[10px] font-medium ${cell.isCurrentMonth ? "bg-red-100/80 text-red-700" : "bg-slate-100 text-slate-400"}`}
                              title={holiday.name}
                            >
                              {holiday.name}
                            </span>
                          )}
                        </div>

                        <div className={`-mx-1.5 mt-1 flex-1 space-y-1 lg:-mx-2 ${!cell.isCurrentMonth ? "opacity-50" : ""}`}>
                          {visibleEvents.map((evt) => {
                            const group = groups.find((g) => g.id === evt.group_id);
                            const isMultiDay = evt.end_date && evt.end_date !== evt.date;
                            let widthClasses = "mx-1.5 lg:mx-2 rounded-md";
                            let showContent = true;

                            if (isMultiDay) {
                              const isStart = cell.dateStr === evt.date;
                              const isEnd = cell.dateStr === evt.end_date;
                              const isMiddle = cell.dateStr > evt.date && cell.dateStr < (evt.end_date || "");

                              if (isStart) {
                                widthClasses = "ml-1.5 lg:ml-2 mr-0 rounded-l-md rounded-r-none border-r-0";
                              } else if (isEnd) {
                                widthClasses = "mr-1.5 lg:mr-2 ml-0 rounded-r-md rounded-l-none border-l-0";
                              } else if (isMiddle) {
                                widthClasses = "mx-0 rounded-none border-x-0";
                              }

                              const isStartOfWeek = idx % 7 === 0;
                              const isFirstCell = idx === 0;
                              showContent = isStart || isStartOfWeek || isFirstCell;
                            }

                            return (
                              <div
                                key={evt.id}
                                data-calendar-event-id={evt.id}
                                onMouseEnter={(mouse) => setPreview({ event: evt, group, anchor: mouse.currentTarget, date: cell.dateStr })}
                                onMouseLeave={() => setPreview(null)}
                                className={`relative flex min-w-0 gap-1 border px-1.5 py-0.5 text-[11px] leading-snug transition-all hover:z-50 hover:shadow-sm lg:text-xs ${
                                  isMultiDay ? "z-10 items-center" : "items-start"
                                } ${widthClasses} ${group ? "" : "border-slate-200 bg-slate-50 text-slate-700"}`}
                                style={group ? getGroupBadgeStyle(group) : undefined}
                              >
                                {showContent ? (
                                  isMultiDay ? (
                                    <>
                                      {evt.start_time && <span className="shrink-0 font-semibold tabular-nums">{evt.start_time}</span>}
                                      <span className="min-w-0 flex-1 truncate text-left">{evt.title}</span>
                                      {evt.is_online && <Video className="h-3 w-3 shrink-0 opacity-70" aria-hidden="true" />}
                                    </>
                                  ) : (
                                    <span className="line-clamp-2 min-w-0 flex-1 text-left [overflow-wrap:anywhere]">
                                      {evt.start_time && <span className="mr-1 font-semibold tabular-nums">{evt.start_time}</span>}
                                      {evt.title}
                                      {evt.is_online && <Video className="ml-1 inline-block h-3 w-3 align-[-2px] opacity-70" aria-hidden="true" />}
                                    </span>
                                  )
                                ) : (
                                  <span className="pointer-events-none min-w-0 flex-1 select-none truncate opacity-0">{evt.title}</span>
                                )}
                              </div>
                            );
                          })}
                          {hiddenCount > 0 && (
                            <p className="mx-1.5 px-1 text-[11px] font-medium text-slate-500 lg:mx-2">+{hiddenCount} รายการ</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Mobile compact grid */}
              <div className="block sm:hidden">
                <div className="grid grid-cols-7 border-b border-slate-100 py-2 text-center text-[11px] font-medium text-slate-500">
                  {DAYS_SHORT.map((day, idx) => (
                    <div key={day} className={idx === 0 ? "text-red-600" : ""}>{day}</div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-0.5 p-1.5">
                  {calendarCells.map((cell, idx) => {
                    const dayEvents = getEventsForDate(cell.dateStr);
                    const holiday = getHolidayForDate(cell.dateStr);
                    const isSelected = selectedDate === cell.dateStr;
                    const isToday = todayStr === cell.dateStr;

                    return (
                      <button
                        id={`cell-mobile-${cell.dateStr}`}
                        key={`mob-${cell.dateStr}-${idx}`}
                        type="button"
                        aria-label={`${formatSelectedDateThaiWithDay(cell.dateStr)}${holiday ? ` · ${holiday.name}` : ""} · ${dayEvents.length} กิจกรรม`}
                        aria-pressed={isSelected}
                        aria-current={isToday ? "date" : undefined}
                        onClick={() => onSelectDate(cell.dateStr)}
                        className={`relative flex aspect-square flex-col items-center justify-center gap-1 rounded-xl transition-colors ${
                          isSelected ? "bg-red-50 ring-2 ring-inset ring-red-500" : "hover:bg-slate-50"
                        } ${!cell.isCurrentMonth ? "opacity-40" : ""}`}
                      >
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-full text-sm tabular-nums ${
                            isToday
                              ? "bg-red-600 font-semibold text-white"
                              : idx % 7 === 0 || holiday
                                ? "font-medium text-red-600"
                                : "font-medium text-slate-800"
                          }`}
                        >
                          {cell.dayNum}
                        </span>
                        <span className="flex h-1.5 items-center justify-center gap-0.5" aria-hidden="true">
                          {holiday && <span className="h-1.5 w-1.5 rounded-full bg-red-500" />}
                          {dayEvents.slice(0, 3).map((evt) => {
                            const group = groups.find((g) => g.id === evt.group_id);
                            return <span key={evt.id} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: getGroupPalette(group?.color).color }} />;
                          })}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="p-3 sm:p-5">
              <div className="mb-4 flex items-center gap-1 rounded-xl bg-slate-100 p-1 sm:w-fit">
                <button
                  type="button"
                  onClick={() => setAgendaSubTab("meetings")}
                  aria-pressed={agendaSubTab === "meetings"}
                  className={`flex-1 rounded-lg px-4 text-sm font-medium transition-all sm:flex-none ${
                    agendaSubTab === "meetings" ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  วาระงาน ({totalMeetingsCount})
                </button>
                <button
                  type="button"
                  onClick={() => setAgendaSubTab("holidays")}
                  aria-pressed={agendaSubTab === "holidays"}
                  className={`flex-1 rounded-lg px-4 text-sm font-medium transition-all sm:flex-none ${
                    agendaSubTab === "holidays" ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  วันหยุด ({totalHolidaysCount})
                </button>
              </div>

              {agendaSubTab === "meetings" ? (
                meetingAgendaItems.length === 0 ? (
                  emptyMeetings("month")
                ) : (
                  <ol className="space-y-5">
                    {meetingAgendaItems.map((item) => (
                      <li key={item.dateStr} className="grid gap-3 sm:grid-cols-[3.5rem_minmax(0,1fr)] sm:gap-4">
                        <button
                          type="button"
                          onClick={() => { onSelectDate(item.dateStr); setViewMode("calendar"); }}
                          title="ดูในปฏิทิน"
                          className="flex items-center gap-3 self-start text-left sm:flex-col sm:gap-1"
                        >
                          {renderDateBadge(item.dateStr, "lg")}
                          <span className="text-sm font-medium text-slate-700 sm:hidden">{formatSelectedDateThaiWithDay(item.dateStr)}</span>
                        </button>
                        <div className="@container min-w-0 space-y-3">
                          {item.dayEvents.map((evt) => (
                            <Fragment key={evt.id}>
                              <CalendarEventCard
                                event={evt}
                                group={groups.find((group) => group.id === evt.group_id)}
                                view="agenda"
                                occurrenceDate={item.dateStr}
                                dateRangeLabel={evt.end_date && evt.end_date !== evt.date
                                  ? `${formatSelectedDateThai(evt.date)} - ${formatSelectedDateThai(evt.end_date)}`
                                  : undefined}
                                isLoggedIn={isLoggedIn}
                                canManage={canManageEvent(evt)}
                                onEdit={onEditEvent}
                                onDuplicate={onDuplicateEvent}
                                onDelete={onDeleteEvent}
                                onOpenParticipantPdf={onOpenParticipantPdf}
                              />
                            </Fragment>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ol>
                )
              ) : holidayAgendaItems.length === 0 ? (
                <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-10 text-center">
                  <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-red-400 shadow-sm ring-1 ring-slate-200/70">
                    <CalendarDays className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <h3 className="text-sm font-semibold text-slate-800">ไม่มีวันหยุดราชการในเดือนนี้</h3>
                  <p className="mt-1 max-w-sm text-sm leading-relaxed text-slate-500">
                    ไม่พบวันหยุดในเดือน{THAI_MONTHS[month]} พ.ศ. {year + 543}
                    {!showHolidays && " · ตัวเลือก “วันหยุดราชการ” ถูกปิดอยู่"}
                  </p>
                </div>
              ) : (
                <ol className="space-y-4">
                  {holidayAgendaItems.map((item) => (
                    <li key={item.dateStr} className="grid gap-3 sm:grid-cols-[3.5rem_minmax(0,1fr)] sm:gap-4">
                      <button
                        type="button"
                        onClick={() => { onSelectDate(item.dateStr); setViewMode("calendar"); }}
                        title="ดูในปฏิทิน"
                        className="flex items-center gap-3 self-start text-left sm:flex-col sm:gap-1"
                      >
                        {renderDateBadge(item.dateStr, "lg")}
                        <span className="text-sm font-medium text-slate-700 sm:hidden">{formatSelectedDateThaiWithDay(item.dateStr)}</span>
                      </button>
                      <div className="min-w-0 space-y-2">{item.dayHolidays.map(renderHolidayRow)}</div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </section>

        {viewMode === "calendar" && (
          <aside
            aria-labelledby="selected-day-heading"
            className="min-w-0 overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-900/[0.03] lg:sticky lg:top-20"
          >
            <div className="flex items-center gap-3 border-b border-slate-100 p-4">
              {selectedDate && renderDateBadge(selectedDate, "lg")}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-slate-500">
                  {isSelectedToday ? "วันนี้ · " : ""}วัน{DAYS_FULL[selectedDayIndex]}
                </p>
                <h3 id="selected-day-heading" className="text-base font-semibold leading-snug text-slate-900">
                  {formatSelectedDateThai(selectedDate)}
                </h3>
              </div>
              <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 tabular-nums">
                {selectedEvents.length} กิจกรรม
              </span>
            </div>

            <div className="@container space-y-3 p-3 sm:p-4 lg:max-h-[calc(100dvh-11rem)] lg:overflow-y-auto">
              {selectedHolidays.map(renderHolidayRow)}
              {selectedEvents.length === 0 ? (
                emptyMeetings("day")
              ) : (
                selectedEvents.map((evt) => (
                  <Fragment key={evt.id}>
                    <CalendarEventCard
                      event={evt}
                      group={groups.find((group) => group.id === evt.group_id)}
                      view="day"
                      occurrenceDate={selectedDate}
                      dateRangeLabel={evt.end_date && evt.end_date !== evt.date
                        ? `${formatSelectedDateThai(evt.date)} - ${formatSelectedDateThai(evt.end_date)}`
                        : undefined}
                      isLoggedIn={isLoggedIn}
                      canManage={canManageEvent(evt)}
                      onEdit={onEditEvent}
                      onDuplicate={onDuplicateEvent}
                      onDelete={onDeleteEvent}
                      onOpenParticipantPdf={onOpenParticipantPdf}
                    />
                  </Fragment>
                ))
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

// Global Date format helper
function formatSelectedDateThai(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);

  const months = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
  ];

  return `${d} ${months[m]} พ.ศ. ${y + 543}`;
}

function formatSelectedDateThaiWithDay(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  
  const dateObj = new Date(y, m, d);
  const dayIndex = dateObj.getDay(); // 0 = Sun, 1 = Mon ...
  const daysFull = ["วันอาทิตย์ที่", "วันจันทร์ที่", "วันอังคารที่", "วันพุธที่", "วันพฤหัสบดีที่", "วันศุกร์ที่", "วันเสาร์ที่"];
  const months = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
  ];

  return `${daysFull[dayIndex]} ${d} ${months[m]} พ.ศ. ${y + 543}`;
}
