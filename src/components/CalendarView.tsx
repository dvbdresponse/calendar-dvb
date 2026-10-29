import { Fragment, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Video, Calendar, List, CalendarDays, Filter, Inbox } from "lucide-react";
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

  const canManageHoliday = (holiday: UnifiedHoliday) => {
    const originalEvent = holiday.id ? events.find(e => e.id === holiday.id) : undefined;
    return !!originalEvent && canManageEvent(originalEvent);
  };

  const hasFilters = !!searchTerm.trim() || activeGroupFilters.length > 0;
  const emptyMeetings = (period: "day" | "month") => (
    <div role="status" className="text-center py-8 px-4 text-slate-600 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
      <Inbox className="w-10 h-10 text-slate-500 mx-auto mb-3" aria-hidden="true" />
      <h3 className="text-base font-semibold text-slate-800">
        {!showAgendas ? "ซ่อนกิจกรรมอยู่" : hasFilters ? "ไม่พบกิจกรรมที่ตรงกับการค้นหาหรือตัวกรอง" : period === "day" ? "ไม่มีกิจกรรมในวันที่เลือก" : "ไม่มีกิจกรรมในเดือนนี้"}
      </h3>
      <p className="text-sm mt-2 leading-relaxed">
        {!showAgendas ? "เปิดการแสดงกิจกรรมเพื่อดูรายการประชุม" : hasFilters ? "ลองล้างคำค้นและตัวกรองกลุ่มงานเพื่อดูรายการทั้งหมด" : isLoggedIn ? "เลือกวันที่อื่น หรือใช้ปุ่มเพิ่มกิจกรรมด้านบนเพื่อบันทึกกิจกรรมใหม่" : "เลือกวันที่อื่นเพื่อดูกิจกรรม หรือเข้าสู่ระบบเพื่อเพิ่มกิจกรรม"}
      </p>
      {!showAgendas ? (
        <button type="button" onClick={() => setShowAgendas(true)} className="mt-3 px-4 py-2 text-sm font-semibold text-red-700 underline underline-offset-4">แสดงกิจกรรม</button>
      ) : hasFilters ? (
        <button type="button" onClick={() => { onClearFilters(); onClearSearch(); }} className="mt-3 px-4 py-2 text-sm font-semibold text-red-700 underline underline-offset-4">ล้างคำค้นและตัวกรอง</button>
      ) : !isLoggedIn ? (
        <button type="button" onClick={onRequestLogin} className="mt-3 px-4 py-2 text-sm font-semibold text-red-700 underline underline-offset-4">เข้าสู่ระบบ</button>
      ) : null}
    </div>
  );

  return (
    <div className="calendar-surface min-w-0 space-y-4 sm:space-y-6">
      
      {preview && <CalendarEventPreview preview={preview} onDismiss={() => setPreview(null)} />}

      {/* 1. Group & Content Filters Panel */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 sm:p-5">
        <button id="calendar-filter-toggle" type="button" aria-expanded={isFilterOpen} aria-controls="calendar-filters" onClick={() => setIsFilterOpen(!isFilterOpen)} className="md:hidden flex w-full items-center justify-between gap-2 text-sm font-semibold text-slate-800">
          <span className="flex items-center gap-2"><Filter className="w-4 h-4" aria-hidden="true" />ตัวกรอง {activeGroupFilters.length > 0 ? `(${activeGroupFilters.length} กลุ่ม)` : "· ทุกกลุ่มงาน"}</span>
          <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${isFilterOpen ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
        <div id="calendar-filters" className={`${isFilterOpen ? "block mt-3" : "hidden"} md:block md:mt-0`}>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Column: Group Filters */}
          <div className="lg:col-span-3 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Filter className="w-[18px] h-[18px] text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider font-sans">
                  กรองแสดงตามกลุ่มงาน / กองสังกัด
                </h3>
              </div>
              {activeGroupFilters.length > 0 && (
                <button
                  id="clear-group-filters-btn"
                  onClick={onClearFilters}
                  className="text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 px-2.5 py-1 rounded-lg transition-colors"
                >
                  แสดงกลุ่มงานทั้งหมด ({groups.length})
                </button>
              )}
            </div>

            {/* Legend buttons */}
            <div className="flex flex-wrap gap-2">
              {groups.map((group) => {
                const isActive = activeGroupFilters.includes(group.id);
                const count = getGroupEventCount(group.id);
                const palette = getGroupPalette(group.color);
                return (
                  <button
                    id={`filter-group-${group.id}-btn`}
                    key={group.id}
                    type="button"
                    aria-pressed={activeGroupFilters.length === 0 || isActive}
                    onClick={() => onToggleGroupFilter(group.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs transition-all duration-200 cursor-pointer ${
                      activeGroupFilters.length === 0 || isActive
                        ? "shadow-sm font-semibold scale-[1.01]"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 font-medium"
                    }`}
                    style={activeGroupFilters.length === 0 || isActive ? getGroupBadgeStyle(group) : undefined}
                  >
                    <span 
                      className="w-2 h-2 rounded-full shrink-0" 
                      style={{ backgroundColor: palette.color }}
                    />
                    <span className="font-sans">{group.name}</span>
                    <span className="px-1.5 py-0.25 bg-white/70 rounded-full text-[10px] font-mono font-semibold">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Content Type Filters (แยกวันหยุดออกจากวาระงาน) */}
          <div className="lg:col-span-1 border-t lg:border-t-0 lg:border-l border-slate-100 pt-5 lg:pt-0 lg:pl-6 space-y-3">
            <div className="pb-3 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider font-sans flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4 text-slate-500" />
                <span>ตัวเลือกการแสดงผล</span>
              </h3>
            </div>
            
            <div className="flex flex-col gap-2">
              <button
                id="toggle-show-agendas"
                type="button"
                aria-pressed={showAgendas}
                onClick={() => setShowAgendas(!showAgendas)}
                className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs transition-all duration-150 cursor-pointer ${
                  showAgendas
                    ? "bg-slate-900 border-slate-900 text-white font-bold shadow-sm"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-600 font-medium"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Calendar className={`w-3.5 h-3.5 ${showAgendas ? "text-red-400" : "text-slate-600"}`} />
                  <span>แสดงวาระงานและกิจกรรม</span>
                </div>
                <span className="ml-2 text-xs">{showAgendas ? "แสดง" : "ซ่อน"}</span>
              </button>

              <button
                id="toggle-show-holidays"
                type="button"
                aria-pressed={showHolidays}
                onClick={() => setShowHolidays(!showHolidays)}
                className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs transition-all duration-150 cursor-pointer ${
                  showHolidays
                    ? "bg-slate-900 border-slate-900 text-white font-bold shadow-sm"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-600 font-medium"
                }`}
              >
                <div className="flex items-center gap-2">
                  <CalendarDays className={`w-3.5 h-3.5 ${showHolidays ? "text-red-400" : "text-slate-600"}`} />
                  <span>แสดงวันหยุดราชการ</span>
                </div>
                <span className="ml-2 text-xs">{showHolidays ? "แสดง" : "ซ่อน"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      </div>

      {/* 2. Monthly Calendar Component Main */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        
        {/* Calendar Nav Header */}
        <div className="p-4 sm:px-5 sm:py-4 bg-slate-50/40 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-red-50 text-red-600 rounded-xl">
              <Calendar className="w-[22px] h-[22px] text-red-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 font-sans tracking-tight">
                {THAI_MONTHS[month]} {year + 543}
              </h2>
              <p className="text-sm text-slate-600 font-sans">เลือกวันที่เพื่อดูกิจกรรม</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* View Mode Toggle Switcher */}
            <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200/50 shadow-inner">
              <button
                id="view-mode-calendar-btn"
                type="button"
                aria-pressed={viewMode === "calendar"}
                onClick={() => setViewMode("calendar")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
                  viewMode === "calendar"
                    ? "bg-white text-slate-800 shadow-sm border border-slate-200"
                    : "text-slate-500 hover:text-slate-800 border border-transparent"
                }`}
              >
                <Calendar className="w-3.5 h-3.5 text-red-500" />
                <span>ปฏิทินรายเดือน</span>
              </button>
              <button
                id="view-mode-agenda-btn"
                type="button"
                aria-pressed={viewMode === "agenda"}
                onClick={() => setViewMode("agenda")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
                  viewMode === "agenda"
                    ? "bg-white text-slate-800 shadow-sm border border-slate-200"
                    : "text-slate-500 hover:text-slate-800 border border-transparent"
                }`}
              >
                <List className="w-3.5 h-3.5 text-red-500" />
                <span>วาระงาน ({totalMeetingsCount})</span>
              </button>
            </div>

            {/* Separator */}
            <div className="hidden sm:block h-6 w-[1px] bg-slate-200" />

            {/* Month Nav Buttons */}
            <div className="flex items-center gap-1.5">
              <button
                id="prev-month-btn"
                onClick={handlePrevMonth}
                className="p-1.5 border border-slate-200 hover:border-slate-300 rounded-xl bg-white hover:bg-slate-50 text-slate-500 transition-colors cursor-pointer"
                title="เดือนก่อนหน้า"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                id="today-btn"
                onClick={handleGoToToday}
                className="text-[11px] font-semibold px-3 py-1.5 border border-slate-200 hover:border-slate-300 rounded-xl bg-white hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
              >
                วันนี้
              </button>

              <button
                id="next-month-btn"
                onClick={handleNextMonth}
                className="p-1.5 border border-slate-200 hover:border-slate-300 rounded-xl bg-white hover:bg-slate-50 text-slate-500 transition-colors cursor-pointer"
                title="เดือนถัดไป"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

        </div>

        {viewMode === "calendar" ? (
          <>
            {/* Calendar Desktop/Tablet Grid */}
            <div className="hidden sm:block">
              {/* Days of week header row */}
              <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/50 text-center py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {DAYS_FULL.map((day, idx) => (
                  <div 
                    key={day} 
                    className={`font-sans py-1 ${idx === 0 ? "text-red-600" : idx === 6 ? "text-slate-700" : ""}`}
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar month grid cells */}
              <div className="grid grid-cols-7 divide-x divide-y divide-slate-100/50 bg-slate-100 border-t border-slate-100 relative z-0">
                {calendarCells.map((cell, idx) => {
                  const dayEvents = getEventsForDate(cell.dateStr);
                  const holiday = getHolidayForDate(cell.dateStr);
                  const isSelected = selectedDate === cell.dateStr;
                  const isToday = todayStr === cell.dateStr;

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
                      className={`min-w-0 min-h-[110px] p-2 bg-white transition-all cursor-pointer relative hover:bg-slate-50/50 hover:!z-[150] flex flex-col justify-between group ${
                        !cell.isCurrentMonth ? "opacity-30" : ""
                      } ${
                        isSelected ? "ring-2 ring-red-500/10 bg-red-50/5 z-10" : ""
                      } ${
                        isToday ? "bg-red-50/5" : ""
                      }`}
                    >
                      {/* Top cell header */}
                      <div className="flex items-start justify-between">
                        <span 
                          className={`text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center transition-colors ${
                            isToday 
                              ? "bg-red-600 text-white font-semibold" 
                              : cell.isCurrentMonth
                                ? idx % 7 === 0 // Sunday
                                  ? "text-red-600"
                                  : "text-slate-700"
                                : "text-slate-600"
                          }`}
                        >
                          {cell.dayNum}
                        </span>

                        {/* Holiday Indicator */}
                        {holiday && (
                          <span 
                            className="text-[9px] font-bold text-red-600 bg-red-50 border border-red-100 rounded px-1.5 py-0.5 max-w-[85px] truncate block hover:overflow-visible hover:whitespace-normal" 
                            title={holiday.name}
                          >
                            {holiday.name}
                          </span>
                        )}
                      </div>

                      {/* Middle event list (pills) */}
                      <div className="flex-1 mt-2 -mx-2 space-y-1">
                        {dayEvents.map((evt) => {
                          const group = groups.find(g => g.id === evt.group_id);
                          const isMultiDay = evt.end_date && evt.end_date !== evt.date;
                          let widthClasses = "mx-2 rounded-md"; // default for single day
                          
                          let showContent = true;

                          if (isMultiDay) {
                            const isStart = cell.dateStr === evt.date;
                            const isEnd = cell.dateStr === evt.end_date;
                            const isMiddle = cell.dateStr > evt.date && cell.dateStr < (evt.end_date || "");

                            if (isStart) {
                              widthClasses = "ml-2 mr-0 rounded-l-md rounded-r-none border-r-0";
                            } else if (isEnd) {
                              widthClasses = "mr-2 ml-0 rounded-r-md rounded-l-none border-l-0";
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
                              className={`group/pill min-w-0 text-xs leading-snug px-1.5 py-0.5 border flex ${
                                isMultiDay ? "items-center" : "items-start"
                              } gap-1 transition-all relative hover:z-50 ${
                                !isMultiDay ? "hover:translate-x-0.5" : "z-10"
                              } ${widthClasses} ${group ? "" : "bg-slate-50 border-slate-200 text-slate-700"}`}
                              style={group ? getGroupBadgeStyle(group) : undefined}
                            >
                              {showContent ? (
                                isMultiDay ? (
                                  <>
                                    {evt.start_time && (
                                      <span className="font-semibold shrink-0 font-sans">{evt.start_time}</span>
                                    )}
                                    <span className="hidden xl:inline-block font-semibold px-0.5 bg-white/65 rounded text-[10px] uppercase shrink-0">
                                      {group?.label || "อื่น ๆ"}
                                    </span>
                                    <span className="truncate min-w-0 z-20 pointer-events-none flex-1 text-left font-sans">{evt.title}</span>
                                    {evt.is_online && (
                                      <Video className="w-2.5 h-2.5 shrink-0 opacity-80" />
                                    )}
                                  </>
                                ) : (
                                  <div className="flex-1 min-w-0 text-left font-sans line-clamp-2 [overflow-wrap:anywhere]">
                                    {evt.start_time && (
                                      <span className="font-semibold mr-1 font-sans">{evt.start_time}</span>
                                    )}
                                    <span className="hidden xl:inline-block font-semibold px-0.5 bg-white/65 rounded text-[10px] uppercase mr-1 inline-block align-[0.5px]">
                                      {group?.label || "อื่น ๆ"}
                                    </span>
                                    <span>{evt.title}</span>
                                    {evt.is_online && (
                                      <Video className="w-2.5 h-2.5 inline-block ml-1 align-[-1.5px] opacity-80" />
                                    )}
                                  </div>
                                )
                              ) : (
                                <span className={`opacity-0 select-none flex-1 font-sans ${isMultiDay ? "truncate" : "line-clamp-2 break-words"} min-w-0 pointer-events-none`}>{evt.title}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Highlight bar on selected */}
                      {isSelected && (
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-red-600" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Calendar Mobile View (Alternative layout for smaller screens) */}
            <div className="block sm:hidden">
              {/* Simple compact grid with dots for events */}
              <div className="grid grid-cols-7 text-center border-b border-slate-100 bg-slate-50 py-2.5 text-[11px] font-bold text-slate-500">
                {DAYS_SHORT.map((day, idx) => (
                  <div key={day} className={idx === 0 ? "text-red-500" : ""}>{day}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 divide-x divide-y divide-slate-50 bg-slate-100">
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
                      className={`aspect-square p-1 bg-white flex flex-col items-center justify-between transition-colors relative cursor-pointer ${
                        !cell.isCurrentMonth ? "opacity-30" : ""
                      } ${
                        isSelected ? "bg-red-50 font-bold" : ""
                      }`}
                    >
                      <span 
                        className={`text-xs font-semibold w-5 h-5 rounded-full flex items-center justify-center ${
                          isToday 
                            ? "bg-red-600 text-white font-bold" 
                            : idx % 7 === 0 
                              ? "text-red-500 font-bold" 
                              : "text-slate-700"
                        }`}
                      >
                        {cell.dayNum}
                      </span>

                      {/* Dots indicator */}
                      <div className="flex gap-0.5 justify-center items-center h-2 overflow-hidden mt-0.5">
                        {holiday && (
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                        )}
                        {dayEvents.slice(0, 3).map((evt) => {
                          const group = groups.find(g => g.id === evt.group_id);
                          return (
                            <span 
                              key={evt.id} 
                              className="w-1 h-1 rounded-full shrink-0" 
                              style={{ backgroundColor: getGroupPalette(group?.color).color }}
                            />
                          );
                        })}
                      </div>

                      {isSelected && (
                        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-red-600" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <div className="p-2 sm:p-6 bg-slate-50/20">
            {/* Agenda Sub-Tabs Switcher */}
            <div className="flex border-b border-slate-200 mb-5 pb-0.5 gap-6">
              <button
                type="button"
                onClick={() => setAgendaSubTab("meetings")}
                aria-pressed={agendaSubTab === "meetings"}
                className={`pb-2.5 text-xs font-bold transition-all relative cursor-pointer ${
                  agendaSubTab === "meetings"
                    ? "text-red-600 font-bold"
                    : "text-slate-600 hover:text-slate-600 font-medium"
                }`}
              >
                <span>วาระงาน({totalMeetingsCount})</span>
                {agendaSubTab === "meetings" && (
                  <div className="absolute bottom-0 inset-x-0 h-0.5 bg-red-600 rounded-full" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setAgendaSubTab("holidays")}
                aria-pressed={agendaSubTab === "holidays"}
                className={`pb-2.5 text-xs font-bold transition-all relative cursor-pointer ${
                  agendaSubTab === "holidays"
                    ? "text-red-600 font-bold"
                    : "text-slate-600 hover:text-slate-600 font-medium"
                }`}
              >
                <span>วันหยุด({totalHolidaysCount})</span>
                {agendaSubTab === "holidays" && (
                  <div className="absolute bottom-0 inset-x-0 h-0.5 bg-red-600 rounded-full" />
                )}
              </button>
            </div>

            {agendaSubTab === "meetings" ? (
              meetingAgendaItems.length === 0 ? (
                emptyMeetings("month")
              ) : (
                <div className="space-y-6">
                  {meetingAgendaItems.map((item) => {
                    const isToday = todayStr === item.dateStr;
                    return (
                      <div 
                        key={item.dateStr}
                        className={`bg-white rounded-2xl border-0 sm:border transition-all duration-200 p-0 sm:p-5 shadow-none sm:shadow-sm/5 ${
                          isToday 
                            ? "border-red-200 ring-2 ring-red-100/30 bg-red-50/5" 
                            : "border-slate-100 hover:border-slate-200"
                        }`}
                      >
                        {/* Day Header */}
                        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
                          <button
                            type="button"
                            onClick={() => onSelectDate(item.dateStr)}
                            className="flex items-center gap-2.5 text-left group cursor-pointer"
                          >
                            <span className={`w-2.5 h-2.5 rounded-full ${isToday ? "bg-red-600" : "bg-slate-300 group-hover:bg-red-500"} transition-colors`} />
                            <h4 className="text-sm font-bold text-slate-800 font-sans group-hover:text-red-600 transition-colors">
                              {formatSelectedDateThaiWithDay(item.dateStr)}
                            </h4>
                            {isToday && (
                              <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md font-sans">
                                วันนี้
                              </span>
                            )}
                          </button>
                        </div>

                        {/* Day's Events List */}
                        <div className="space-y-3.5">
                          {item.dayEvents.map((evt) => (
                            <Fragment key={evt.id}>
                              <CalendarEventCard
                                event={evt}
                                group={groups.find(group => group.id === evt.group_id)}
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
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              holidayAgendaItems.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl border border-slate-100 p-6 shadow-sm/5 animate-fade-in">
                  <Calendar className="w-16 h-16 text-red-400 mx-auto mb-4" />
                  <h3 className="text-base font-bold text-slate-800 font-sans">ไม่มีวันหยุดราชการหรือสำนักงานในเดือนนี้</h3>
                  <p className="text-xs text-slate-600 font-sans mt-1.5 max-w-md mx-auto leading-relaxed">
                    ไม่พบข้อมูลวันหยุดนักขัตฤกษ์ในเดือน {THAI_MONTHS[month]} พ.ศ. {year + 543} ท่านสามารถเปิดใช้งานตัวเลือก "แสดงวันหยุดราชการ" หรือตั้งค่าเพิ่มวันหยุดในปฏิทินได้
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {holidayAgendaItems.map((item) => {
                    const isToday = todayStr === item.dateStr;
                    return (
                      <div 
                        key={item.dateStr}
                        className={`bg-white rounded-2xl border transition-all duration-200 p-4 sm:p-5 shadow-sm/5 ${
                          isToday 
                            ? "border-red-200 ring-2 ring-red-100/30 bg-red-50/5" 
                            : "border-slate-100 hover:border-slate-200"
                        }`}
                      >
                        {/* Day Header */}
                        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
                          <button
                            type="button"
                            onClick={() => onSelectDate(item.dateStr)}
                            className="flex items-center gap-2.5 text-left group cursor-pointer"
                          >
                            <span className={`w-2.5 h-2.5 rounded-full ${isToday ? "bg-red-600" : "bg-slate-300 group-hover:bg-red-500"} transition-colors`} />
                            <h4 className="text-sm font-bold text-slate-800 font-sans group-hover:text-red-600 transition-colors">
                              {formatSelectedDateThaiWithDay(item.dateStr)}
                            </h4>
                            {isToday && (
                              <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md font-sans">
                                วันนี้
                              </span>
                            )}
                          </button>
                        </div>

                        {/* Day's Holidays List */}
                        <div className="space-y-3">
                          {item.dayHolidays.map((h, idx) => (
                            <div 
                              key={idx}
                              className="bg-red-50/40 border border-red-100/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors hover:bg-red-50/60"
                            >
                              <div className="flex items-start gap-3">
                                <CalendarDays className="w-[22px] h-[22px] text-red-600 shrink-0 mt-0.5" />
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h5 className="text-sm font-bold text-red-800 font-sans leading-snug">
                                      {h.name}
                                    </h5>
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-orange-100 text-orange-700 border border-orange-200">
                                      วันหยุด
                                    </span>
                                  </div>
                                  <p className="text-xs text-red-600/70 font-sans mt-0.5">
                                    กำหนดโดยผู้ลงบันทึก: {h.created_by || "ระบบ"}
                                  </p>
                                </div>
                              </div>

                              {/* Holiday controls */}
                              {isLoggedIn && h.id && canManageHoliday(h) && (
                                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const originalEvt = events.find(e => e.id === h.id);
                                      if (originalEvt) onEditEvent(originalEvt);
                                    }}
                                    className="text-[10px] font-bold text-slate-600 hover:text-indigo-600 bg-white hover:bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                                  >
                                    แก้ไข
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => h.id && onDeleteEvent(h.id)}
                                    className="text-[10px] font-bold text-slate-500 hover:text-red-600 bg-white hover:bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                                  >
                                    ลบ
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>
        )}

      </div>

      {/* 3. Detail Section for Selected Date */}
      {viewMode === "calendar" && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-2 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
          <div>
            <span className="text-xs font-bold text-red-600 uppercase tracking-wide font-sans bg-red-50 border border-red-200 rounded-lg px-2.5 py-1 inline-block mb-1.5">
              รายการกิจกรรมและวันหยุด
            </span>
            <h3 className="text-base font-bold text-slate-800 font-sans flex items-center gap-2">
              ประจำวันที่ {formatSelectedDateThai(selectedDate)}
            </h3>
          </div>
        </div>

        {/* Holiday Details (if any on selected day) */}
        {getHolidaysForDate(selectedDate).map((holiday) => {
          const originalEvt = events.find(e => e.id === holiday.id);
          return (
            <div key={holiday.id} className="mb-4 bg-red-50/70 border border-red-200/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <CalendarDays className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-red-800 font-sans">
                    วันหยุด: {holiday.name}
                  </h4>
                  <p className="text-xs text-red-600 font-sans mt-0.5">
                    กำหนดโดยผู้ลงบันทึก: {holiday.created_by || "ระบบ"}
                  </p>
                </div>
              </div>
              {isLoggedIn && originalEvt && canManageEvent(originalEvt) && (
                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => onEditEvent(originalEvt)}
                    className="text-[11px] font-semibold text-slate-600 hover:text-indigo-600 hover:bg-white px-2.5 py-1.5 rounded-lg border border-red-200 bg-white/70 transition-colors"
                  >
                    แก้ไข
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteEvent(originalEvt.id)}
                    className="text-[11px] font-semibold text-slate-500 hover:text-red-600 hover:bg-white px-2.5 py-1.5 rounded-lg border border-red-200 bg-white/70 transition-colors"
                  >
                    ลบ
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* Selected date events list */}
        {getEventsForDate(selectedDate).length === 0 ? (
          emptyMeetings("day")
        ) : (
          <div className="space-y-3.5">
            {getEventsForDate(selectedDate).map((evt) => (
              <Fragment key={evt.id}>
                <CalendarEventCard
                  event={evt}
                  group={groups.find(group => group.id === evt.group_id)}
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
            ))}
          </div>
        )}
      </div>
    )}

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
