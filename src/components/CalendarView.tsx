import { useState } from "react";
import { ChevronLeft, ChevronRight, Video, Calendar, List, Clock, MapPin, User, CalendarDays } from "lucide-react";
import { EventData, Group, Holiday } from "../types";
import { THAI_HOLIDAYS_2026 } from "../data/constants";
import LordIcon from "./LordIcon";

interface UnifiedHoliday {
  name: string;
  isOfficial: boolean;
  id?: string;
  created_by?: string;
}

interface CalendarViewProps {
  events: EventData[];
  groups: Group[];
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (date: string) => void;
  onEditEvent: (event: EventData) => void;
  onDeleteEvent: (id: string) => void;
  activeGroupFilters: string[];
  onToggleGroupFilter: (groupId: string) => void;
  onClearFilters: () => void;
  isLoggedIn: boolean;
  canManageEvent?: (event: EventData) => boolean;
}

export default function CalendarView({
  events,
  groups,
  selectedDate,
  onSelectDate,
  onEditEvent,
  onDeleteEvent,
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

  // Get all holidays for a specific date (official & custom)
  const getHolidaysForDate = (dateStr: string): UnifiedHoliday[] => {
    if (!showHolidays) return [];
    const list: UnifiedHoliday[] = [];
    
    // Official holidays
    const official = THAI_HOLIDAYS_2026.find(h => h.date === dateStr);
    if (official) {
      list.push({ name: official.name, isOfficial: true });
    }
    
    // Custom holiday events
    const userHolidays = events.filter(e => isDateInRange(e, dateStr) && e.is_holiday);
    userHolidays.forEach(uh => {
      list.push({ 
        id: uh.id,
        name: uh.title, 
        isOfficial: false, 
        created_by: uh.created_by 
      });
    });
    
    return list;
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

  const totalMeetingsCount = meetingAgendaItems.reduce((acc, item) => acc + item.dayEvents.length, 0);
  const totalHolidaysCount = holidayAgendaItems.reduce((acc, item) => acc + item.dayHolidays.length, 0);

  const activeAgendaLength = agendaSubTab === "meetings" ? totalMeetingsCount : totalHolidaysCount;
  const canManageHoliday = (holiday: UnifiedHoliday) => {
    const originalEvent = holiday.id ? events.find(e => e.id === holiday.id) : undefined;
    return !!originalEvent && canManageEvent(originalEvent);
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Group & Content Filters Panel */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Column: Group Filters */}
          <div className="lg:col-span-3 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <LordIcon 
                  src="https://cdn.lordicon.com/sbreugur.json" 
                  colors="primary:#64748b,secondary:#475569" 
                  size={18} 
                  trigger="hover"
                />
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
                return (
                  <button
                    id={`filter-group-${group.id}-btn`}
                    key={group.id}
                    onClick={() => onToggleGroupFilter(group.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs transition-all duration-200 cursor-pointer ${
                      activeGroupFilters.length === 0 || isActive
                        ? `${group.bgColor} ${group.textColor} ${group.borderColor} shadow-sm font-semibold scale-[1.01]`
                        : "bg-slate-50 border-slate-200 text-slate-400 opacity-60 hover:opacity-100 font-medium"
                    }`}
                  >
                    <span 
                      className="w-2 h-2 rounded-full shrink-0" 
                      style={{ backgroundColor: group.color }}
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
                onClick={() => setShowAgendas(!showAgendas)}
                className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs transition-all duration-150 cursor-pointer ${
                  showAgendas
                    ? "bg-slate-900 border-slate-900 text-white font-bold shadow-sm"
                    : "bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-600 font-medium"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Calendar className={`w-3.5 h-3.5 ${showAgendas ? "text-red-400" : "text-slate-400"}`} />
                  <span>แสดงวาระงานและกิจกรรม</span>
                </div>
                <div className={`w-2 h-2 rounded-full ${showAgendas ? "bg-emerald-400 animate-pulse" : "bg-slate-350"}`} />
              </button>

              <button
                id="toggle-show-holidays"
                type="button"
                onClick={() => setShowHolidays(!showHolidays)}
                className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs transition-all duration-150 cursor-pointer ${
                  showHolidays
                    ? "bg-slate-900 border-slate-900 text-white font-bold shadow-sm"
                    : "bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-600 font-medium"
                }`}
              >
                <div className="flex items-center gap-2">
                  <CalendarDays className={`w-3.5 h-3.5 ${showHolidays ? "text-red-400" : "text-slate-400"}`} />
                  <span>แสดงวันหยุดราชการ</span>
                </div>
                <div className={`w-2 h-2 rounded-full ${showHolidays ? "bg-red-400 animate-pulse" : "bg-slate-350"}`} />
              </button>
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
              <LordIcon 
                src="https://cdn.lordicon.com/qvyppzqz.json" 
                colors="primary:#dc2626,secondary:#ef4444" 
                size={22} 
                trigger="hover"
              />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-850 font-sans tracking-tight">
                {THAI_MONTHS[month]} {year + 543}
              </h2>
              <p className="text-[11px] text-slate-400 font-sans">ปฏิทินแสดงรายเดือนราชการ</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* View Mode Toggle Switcher */}
            <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200/50 shadow-inner">
              <button
                id="view-mode-calendar-btn"
                type="button"
                onClick={() => setViewMode("calendar")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
                  viewMode === "calendar"
                    ? "bg-white text-slate-800 shadow-sm border border-slate-150"
                    : "text-slate-500 hover:text-slate-800 border border-transparent"
                }`}
              >
                <Calendar className="w-3.5 h-3.5 text-red-500" />
                <span>ปฏิทินรายเดือน</span>
              </button>
              <button
                id="view-mode-agenda-btn"
                type="button"
                onClick={() => setViewMode("agenda")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
                  viewMode === "agenda"
                    ? "bg-white text-slate-800 shadow-sm border border-slate-150"
                    : "text-slate-500 hover:text-slate-800 border border-transparent"
                }`}
              >
                <List className="w-3.5 h-3.5 text-red-500" />
                <span>วาระงาน ({activeAgendaLength})</span>
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
                      onClick={() => onSelectDate(cell.dateStr)}
                      style={{ zIndex: 100 - idx }}
                      className={`min-h-[110px] p-2 bg-white transition-all cursor-pointer relative hover:bg-slate-50/50 flex flex-col justify-between group ${
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
                                : "text-slate-400"
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
                              className={`group/pill text-[10px] leading-snug px-1.5 py-0.5 border flex items-center gap-1 transition-all ${
                                !isMultiDay ? "hover:translate-x-0.5" : "relative z-10"
                              } ${widthClasses} ${
                                group ? `${group.bgColor} ${group.textColor} ${group.borderColor}` : "bg-slate-50 border-slate-200 text-slate-700"
                              }`}
                              title={evt.start_time ? `${evt.start_time} - ${evt.title}` : `ตลอดทั้งวัน - ${evt.title}`}
                            >
                              {showContent ? (
                                <>
                                  {evt.start_time && (
                                    <span className="font-semibold shrink-0 font-sans">{evt.start_time}</span>
                                  )}
                                  <span className="font-semibold px-0.5 bg-white/65 rounded text-[8px] uppercase shrink-0">
                                    {group?.label || "อื่น ๆ"}
                                  </span>
                                  <span className={`${isMultiDay ? "whitespace-nowrap overflow-visible z-20 pointer-events-none" : "truncate"} flex-1 text-left font-sans`}>{evt.title}</span>
                                  {evt.is_online && (
                                    <Video className="w-2.5 h-2.5 shrink-0 opacity-80" />
                                  )}
                                </>
                              ) : (
                                <span className="opacity-0 select-none flex-1 font-sans truncate min-w-0 pointer-events-none">{evt.title}</span>
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
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                        )}
                        {dayEvents.slice(0, 3).map((evt) => {
                          const group = groups.find(g => g.id === evt.group_id);
                          return (
                            <span 
                              key={evt.id} 
                              className="w-1 h-1 rounded-full shrink-0" 
                              style={{ backgroundColor: group?.color || "#cbd5e1" }}
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
          <div className="p-4 sm:p-6 bg-slate-50/20">
            {/* Agenda Sub-Tabs Switcher */}
            <div className="flex border-b border-slate-200 mb-5 pb-0.5 gap-6">
              <button
                type="button"
                onClick={() => setAgendaSubTab("meetings")}
                className={`pb-2.5 text-xs font-bold transition-all relative cursor-pointer ${
                  agendaSubTab === "meetings"
                    ? "text-red-600 font-bold"
                    : "text-slate-400 hover:text-slate-600 font-medium"
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
                className={`pb-2.5 text-xs font-bold transition-all relative cursor-pointer ${
                  agendaSubTab === "holidays"
                    ? "text-red-600 font-bold"
                    : "text-slate-400 hover:text-slate-600 font-medium"
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
                <div className="text-center py-16 bg-white rounded-2xl border border-slate-100 p-6 shadow-sm/5 animate-fade-in">
                  <LordIcon 
                    src="https://cdn.lordicon.com/yqymgxtz.json" 
                    colors="primary:#dc2626,secondary:#f87171" 
                    size={64} 
                    trigger="loop" 
                    className="mx-auto mb-4" 
                  />
                  <h3 className="text-base font-bold text-slate-800 font-sans">ไม่มีกิจกรรมการประชุมงานในเดือนนี้</h3>
                  <p className="text-xs text-slate-400 font-sans mt-1.5 max-w-md mx-auto leading-relaxed">
                    ไม่พบข้อมูลวาระงานประชุมราชการในเดือน {THAI_MONTHS[month]} พ.ศ. {year + 543} ท่านสามารถปรับเปลี่ยนตัวกรองกลุ่มงานหรือเพิ่มกิจกรรมการประชุมใหม่ได้
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {meetingAgendaItems.map((item) => {
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
                            <span className={`w-2.5 h-2.5 rounded-full ${isToday ? "bg-red-600 animate-pulse" : "bg-slate-300 group-hover:bg-red-500"} transition-colors`} />
                            <h4 className="text-sm font-bold text-slate-800 font-sans group-hover:text-red-600 transition-colors">
                              {formatSelectedDateThaiWithDay(item.dateStr)}
                            </h4>
                            {isToday && (
                              <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md animate-pulse font-sans">
                                วันนี้
                              </span>
                            )}
                          </button>
                        </div>

                        {/* Day's Events List */}
                        <div className="space-y-3.5">
                          {item.dayEvents.map((evt) => {
                            const group = groups.find(g => g.id === evt.group_id);
                            return (
                              <div
                                key={evt.id}
                                className={`flex flex-col md:flex-row md:items-start justify-between gap-4 p-4 rounded-xl border transition-all duration-150 relative bg-white ${
                                  group ? `hover:shadow-sm/5 border-l-4 ${group.borderColor}` : "border-slate-100"
                                }`}
                                style={{ borderLeftColor: group?.color }}
                              >
                                <div className="space-y-2 flex-1 min-w-0">
                                  {/* Badges line */}
                                  <div className="flex flex-wrap items-center gap-2 text-xs font-sans">
                                    {evt.start_time && evt.end_time ? (
                                      <span className="flex items-center gap-1.25 font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">
                                        <Clock className="w-3 h-3 text-red-500" />
                                        {evt.start_time} - {evt.end_time} น.
                                      </span>
                                    ) : (
                                      <span className="flex items-center gap-1.25 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md text-[11px]">
                                        <Clock className="w-3 h-3 text-emerald-500" />
                                        ตลอดทั้งวัน
                                      </span>
                                    )}
                                    {evt.end_date && evt.end_date !== evt.date && (
                                      <span className="flex items-center gap-1.25 font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">
                                        <Calendar className="w-3 h-3 text-red-500" />
                                        ต่อเนื่อง: {formatSelectedDateThaiWithDay(evt.date).split(' ')[0]} {formatSelectedDateThaiWithDay(evt.date).split(' ')[1]} - {formatSelectedDateThaiWithDay(evt.end_date).split(' ')[0]} {formatSelectedDateThaiWithDay(evt.end_date).split(' ')[1]}
                                      </span>
                                    )}
                                    
                                    {group && (
                                      <span className={`font-bold px-2 py-0.5 rounded-md border text-[11px] ${group.bgColor} ${group.textColor} ${group.borderColor}`}>
                                        {group.name}
                                      </span>
                                    )}

                                    {evt.is_online ? (
                                      <span className="font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center gap-1 text-[11px]">
                                        <Video className="w-3 h-3 text-emerald-500" />
                                        ออนไลน์ {evt.online_platform ? `(${evt.online_platform === 'zoom' ? 'Zoom' : evt.online_platform === 'webex' ? 'Webex' : evt.online_platform === 'teams' ? 'Teams' : evt.online_platform === 'meet' ? 'Meet' : 'กำหนดเอง'})` : ''}
                                      </span>
                                    ) : (
                                      <span className="font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100 flex items-center gap-1 text-[11px]">
                                        <MapPin className="w-3 h-3 text-blue-500" />
                                        ออนไซต์
                                      </span>
                                    )}
                                  </div>

                                  {/* Title & Description */}
                                  <div>
                                    <h5 className="text-sm font-bold text-slate-800 font-sans leading-snug">
                                      {evt.title}
                                    </h5>
                                    {evt.description && (
                                      <p className="text-xs text-slate-500 font-sans mt-1 line-clamp-2 leading-relaxed bg-slate-50/30 p-2 rounded-lg border border-slate-100/60">
                                        {evt.description}
                                      </p>
                                    )}
                                  </div>

                                  {/* Metadata footer */}
                                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1 border-t border-slate-50 text-[11px] text-slate-400 font-sans">
                                    <span className="flex items-center gap-1">
                                      <MapPin className="w-3.5 h-3.5" />
                                      สถานที่: <strong className="text-slate-600 font-medium">{evt.location || "ไม่ได้ระบุสถานที่"}</strong>
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <User className="w-3.5 h-3.5" />
                                      ผู้ลงบันทึก: <strong className="text-slate-600 font-medium">{evt.created_by || "ผู้ดูแลระบบ"}</strong>
                                    </span>
                                  </div>
                                </div>

                                {/* Join Online Meeting link & Actions */}
                                <div className="flex flex-wrap items-center gap-2 shrink-0 md:border-l md:border-slate-100 md:pl-4 self-stretch justify-end md:flex-col md:justify-center">
                                  {evt.is_online && evt.location && (evt.location.startsWith("http://") || evt.location.startsWith("https://") || evt.location.startsWith("www.") || evt.location.includes(".com") || evt.location.includes("meet.google.com") || evt.location.includes(".zoom.us")) && (
                                    <a
                                      href={evt.location.startsWith("http") ? evt.location : `https://${evt.location}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition-colors cursor-pointer shrink-0 w-full animate-pulse animate-duration-1000"
                                    >
                                      <span>เข้าร่วมประชุม</span>
                                      <Video className="w-3.5 h-3.5" />
                                    </a>
                                  )}
                                  
                                  {isLoggedIn && canManageEvent(evt) && (
                                    <div className="flex items-center gap-1.5 w-full">
                                      <button
                                        id={`agenda-edit-event-${evt.id}-btn`}
                                        type="button"
                                        onClick={() => onEditEvent(evt)}
                                        className="flex-1 text-center text-[11px] font-semibold text-slate-600 hover:text-indigo-600 hover:bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                                      >
                                        แก้ไข
                                      </button>
                                      <button
                                        id={`agenda-delete-event-${evt.id}-btn`}
                                        type="button"
                                        onClick={() => onDeleteEvent(evt.id)}
                                        className="flex-1 text-center text-[11px] font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 px-2 py-1.5 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                                      >
                                        ลบ
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              holidayAgendaItems.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl border border-slate-100 p-6 shadow-sm/5 animate-fade-in">
                  <LordIcon 
                    src="https://cdn.lordicon.com/qvyppzqz.json" 
                    colors="primary:#dc2626,secondary:#f87171" 
                    size={64} 
                    trigger="loop" 
                    className="mx-auto mb-4" 
                  />
                  <h3 className="text-base font-bold text-slate-800 font-sans">ไม่มีวันหยุดราชการหรือสำนักงานในเดือนนี้</h3>
                  <p className="text-xs text-slate-400 font-sans mt-1.5 max-w-md mx-auto leading-relaxed">
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
                            <span className={`w-2.5 h-2.5 rounded-full ${isToday ? "bg-red-600 animate-pulse" : "bg-slate-300 group-hover:bg-red-500"} transition-colors`} />
                            <h4 className="text-sm font-bold text-slate-800 font-sans group-hover:text-red-600 transition-colors">
                              {formatSelectedDateThaiWithDay(item.dateStr)}
                            </h4>
                            {isToday && (
                              <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md animate-pulse font-sans">
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
                                <LordIcon 
                                  src="https://cdn.lordicon.com/usownftb.json" 
                                  colors="primary:#dc2626,secondary:#f87171" 
                                  size={22} 
                                  trigger="loop" 
                                  className="shrink-0 mt-0.5" 
                                />
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h5 className="text-sm font-bold text-red-800 font-sans leading-snug">
                                      {h.name}
                                    </h5>
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${h.isOfficial ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-orange-100 text-orange-700 border border-orange-200'}`}>
                                      {h.isOfficial ? 'วันหยุดราชการ' : 'วันหยุดสำนักงาน'}
                                    </span>
                                  </div>
                                  <p className="text-xs text-red-600/70 font-sans mt-0.5">
                                    {h.isOfficial ? 'วันหยุดราชการนักขัตฤกษ์อย่างเป็นทางการ' : `กำหนดโดยผู้ลงบันทึก: ${h.created_by || "ผู้ดูแลระบบ"}`}
                                  </p>
                                </div>
                              </div>

                              {/* Custom holiday controls */}
                              {!h.isOfficial && isLoggedIn && h.id && canManageHoliday(h) && (
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
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5">
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
        {getHolidayForDate(selectedDate) && (
          <div className="mb-4 bg-red-50/70 border border-red-200/80 rounded-xl p-4 flex items-start gap-3">
            <LordIcon 
              src="https://cdn.lordicon.com/usownftb.json" 
              colors="primary:#dc2626,secondary:#f87171" 
              size={24} 
              trigger="loop" 
              className="shrink-0 mt-0.5" 
            />
            <div>
              <h4 className="text-sm font-bold text-red-800 font-sans">
                วันนี้คือ {getHolidayForDate(selectedDate)?.name}
              </h4>
              <p className="text-xs text-red-600 font-sans mt-0.5">วันหยุดราชการอย่างเป็นทางการ</p>
            </div>
          </div>
        )}

        {/* Selected date events list */}
        {getEventsForDate(selectedDate).length === 0 ? (
          <div className="text-center py-8 text-slate-400 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-100">
            <LordIcon 
              src="https://cdn.lordicon.com/yqymgxtz.json" 
              colors="primary:#10b981,secondary:#34d399" 
              size={48} 
              trigger="loop" 
              className="mx-auto mb-2" 
            />
            <p className="text-sm font-medium font-sans">ไม่มีกิจกรรมการประชุมในวันนี้</p>
            <p className="text-xs text-slate-400 font-sans mt-0.5">สามารถกดเพิ่มกิจกรรมการประชุมใหม่ด้านบนได้</p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {getEventsForDate(selectedDate).map((evt) => {
              const group = groups.find(g => g.id === evt.group_id);
              return (
                <div
                  id={`event-item-${evt.id}`}
                  key={evt.id}
                  className="group relative flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border border-slate-100 bg-white hover:border-slate-200/80 transition-all shadow-sm/5"
                >
                  {/* Left block: Minimalist Accent color line */}
                  <div 
                    className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-full" 
                    style={{ backgroundColor: group?.color || "#94a3b8" }}
                  />

                  {/* Middle content */}
                  <div className="pl-1.5 space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Start-End Time badge */}
                      {evt.start_time && evt.end_time ? (
                        <span className="text-[11px] font-bold font-sans bg-slate-50 text-slate-700 border border-slate-100 px-2 py-0.5 rounded-lg">
                          {evt.start_time} - {evt.end_time} น.
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold font-sans bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-lg">
                          ตลอดทั้งวัน
                        </span>
                      )}

                      {/* Group label */}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border uppercase ${
                        group ? `${group.bgColor} ${group.textColor} ${group.borderColor}` : "bg-slate-50 border-slate-100 text-slate-500"
                      }`}>
                        {group?.name || "ไม่ระบุฝ่าย"}
                      </span>

                      {/* Online/On-site badge */}
                      {evt.is_online ? (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-lg bg-emerald-50/60 text-emerald-700 border border-emerald-100/50 flex items-center gap-1">
                          <LordIcon 
                            src="https://cdn.lordicon.com/yvbeekuoc.json" 
                            colors="primary:#10b981,secondary:#34d399" 
                            size={12} 
                            trigger="hover" 
                          />
                          ออนไลน์ {evt.online_platform ? `(${evt.online_platform === 'zoom' ? 'Zoom' : evt.online_platform === 'webex' ? 'Webex' : evt.online_platform === 'teams' ? 'Teams' : evt.online_platform === 'meet' ? 'Meet' : 'กำหนดเอง'})` : ''}
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-lg bg-indigo-50/60 text-indigo-700 border border-indigo-100/50 flex items-center gap-1">
                          <LordIcon 
                            src="https://cdn.lordicon.com/iikoxgto.json" 
                            colors="primary:#4f46e5,secondary:#818cf8" 
                            size={12} 
                            trigger="hover" 
                          />
                          ออนไซต์ (ในสถานที่)
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm font-bold text-slate-850 font-sans">
                      {evt.title}
                    </h4>

                    {evt.description && (
                      <p className="text-xs text-slate-500 leading-relaxed max-w-4xl font-sans bg-slate-50/40 p-2 rounded-lg border border-slate-100/60">
                        {evt.description}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-[11px] text-slate-450 font-sans">
                      <span className="flex items-center gap-1 text-slate-400">
                        <LordIcon 
                          src="https://cdn.lordicon.com/iikoxgto.json" 
                          colors="primary:#94a3b8,secondary:#64748b" 
                          size={12} 
                          trigger="hover" 
                        />
                        สถานที่: <strong className="text-slate-600 font-medium">{evt.location || "ไม่ระบุสถานที่"}</strong>
                      </span>
                      <span className="flex items-center gap-1 text-slate-400">
                        <LordIcon 
                          src="https://cdn.lordicon.com/ljvjsgbh.json" 
                          colors="primary:#94a3b8,secondary:#64748b" 
                          size={12} 
                          trigger="hover" 
                        />
                        ผู้ลงบันทึก: <strong className="text-slate-600 font-medium">{evt.created_by || "ผู้ดูแลระบบ"}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Actions right buttons */}
                  {isLoggedIn && canManageEvent(evt) && (
                    <div className="flex items-center justify-end gap-1.5 shrink-0 md:border-l md:border-slate-100 md:pl-3.5">
                      <button
                        id={`edit-event-${evt.id}-btn`}
                        type="button"
                        onClick={() => onEditEvent(evt)}
                        className="text-[11px] font-semibold text-slate-600 hover:text-indigo-600 hover:bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-150 transition-colors"
                      >
                        แก้ไข
                      </button>
                      <button
                        id={`delete-event-${evt.id}-btn`}
                        type="button"
                        onClick={() => onDeleteEvent(evt.id)}
                        className="text-[11px] font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50/50 px-2.5 py-1.5 rounded-lg border border-slate-150 transition-colors"
                      >
                        ลบ
                      </button>
                    </div>
                  )}

                </div>
              );
            })}
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
