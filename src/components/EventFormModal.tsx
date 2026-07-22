import { useState, useEffect, useMemo, useRef, FormEvent } from "react";
import { X, Calendar, Clock, MapPin, AlignLeft, User, Info, Check, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { EventData, Group } from "../types";
import {
  findBookingConflict,
  getOnlineResourceDescription,
  getOnlineResourceLabel,
  getOnlineResourceLink,
  isOfficeBookableRoom,
  OFFICE_BOOKABLE_ROOMS,
  ONLINE_RESOURCES,
} from "../utils/booking";

const EXTERNAL_ROOMS = [
  "ห้องประชุม ประเมินจันทวิมล อาคาร 1 ชั้น 1 กรมควบคุมโรค",
  "ห้องประชุม อายุรกิจโกศล อาคาร 1 ชั้น 2 กรมควบคุมโรค",
  "ห้องประชุม ประยูรกุนาศล อาคาร 1 ชั้น 3 กรมควบคุมโรค",
  "ห้องประชุม อาคาร 10 ชั้น 7 กรมควบคุมโรค",
  "ห้องประชุมชัยนาทนเรนทร",
];

const LOCATION_OTHER_VALUE = "__other__";
const LOCATION_OPTIONS = [...OFFICE_BOOKABLE_ROOMS, ...EXTERNAL_ROOMS];

const formatThaiDate = (dateStr: string) => {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const yearStr = parts[0];
  const monthStr = parts[1];
  const dayStr = parts[2];

  const months = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
  ];
  const day = parseInt(dayStr, 10);
  const monthIdx = parseInt(monthStr, 10) - 1;
  const year = parseInt(yearStr, 10) + 543;

  if (monthIdx >= 0 && monthIdx < 12) {
    return `${day} ${months[monthIdx]} พ.ศ. ${year}`;
  }
  return dateStr;
};

interface EventFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  groups: Group[];
  events: EventData[];
  selectedDate: string; // Prepopulates when creating
  editingEvent: EventData | null; // Prepopulates when editing
  duplicatingEvent?: EventData | null; // Prepopulates from an existing event but saves as NEW (no id)
  currentUserName?: string;
  onSave: (event: Omit<EventData, "id" | "created_at"> & { id?: string }) => void | Promise<void>;
}

export default function EventFormModal({
  isOpen,
  onClose,
  groups,
  events,
  selectedDate,
  editingEvent,
  duplicatingEvent,
  currentUserName,
  onSave,
}: EventFormModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("12:00");
  const [groupId, setGroupId] = useState("gbt");
  const [locationChoice, setLocationChoice] = useState("");
  const [customLocation, setCustomLocation] = useState("");
  const [isOnline, setIsOnline] = useState(false);
  const [onlineLink, setOnlineLink] = useState("");
  const [onlineResource, setOnlineResource] = useState("");
  const [isHoliday, setIsHoliday] = useState(false);
  const [createdBy, setCreatedBy] = useState("");
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [showTitleSuggestions, setShowTitleSuggestions] = useState(false);
  const titleFieldRef = useRef<HTMLDivElement>(null);

  const [pickerYear, setPickerYear] = useState(2026);
  const [pickerMonth, setPickerMonth] = useState(6); // July
  const [pickerType, setPickerType] = useState<"start" | "end" | null>(null);

  useEffect(() => {
    if (isOpen) {
      let initialDate = "";
      // แก้ไข = editingEvent, ทำซ้ำ = duplicatingEvent (prefill เหมือนกัน ต่างที่ตอน save จะไม่มี id → insert ใหม่)
      const source = editingEvent ?? duplicatingEvent;
      if (source) {
        setTitle(source.title);
        setDescription(source.description || "");
        initialDate = source.date;
        setDate(source.date);
        setEndDate(source.end_date || "");
        setStartTime(source.start_time);
        setEndTime(source.end_time);
        setGroupId(source.group_id);
        if (source.location && !LOCATION_OPTIONS.includes(source.location)) {
          setLocationChoice(LOCATION_OTHER_VALUE);
          setCustomLocation(source.location);
        } else {
          setLocationChoice(source.location || "");
          setCustomLocation("");
        }
        setIsOnline(evtToBool(source.is_online));
        setOnlineLink(source.online_link || "");
        setOnlineResource(source.online_resource || "");
        setIsHoliday(evtToBool(source.is_holiday));
        // ทำซ้ำ: ผู้ลงบันทึกควรเป็นคนปัจจุบัน ไม่ใช่คนที่บันทึกต้นฉบับ
        setCreatedBy(editingEvent ? (source.created_by || "") : (currentUserName || source.created_by || ""));
      } else {
        // Create mode
        setTitle("");
        setDescription("");
        initialDate = selectedDate || new Date().toISOString().split("T")[0];
        setDate(initialDate);
        setEndDate("");
        setStartTime("09:00");
        setEndTime("12:00");
        setGroupId(groups[0]?.id || "");
        setLocationChoice("");
        setCustomLocation("");
        setIsOnline(false);
        setOnlineLink("");
        setOnlineResource("");
        setIsHoliday(false);
        setCreatedBy(currentUserName || "");
      }
      setErrors({});
      setPickerType(null);

      if (initialDate) {
        const parts = initialDate.split("-");
        if (parts.length === 3) {
          setPickerYear(parseInt(parts[0], 10));
          setPickerMonth(parseInt(parts[1], 10) - 1);
        }
      }
    }
  }, [isOpen, editingEvent, duplicatingEvent, selectedDate, currentUserName, groups]);

  const evtToBool = (val: any): boolean => {
    if (typeof val === "boolean") return val;
    return val === "true" || val === 1 || val === "1";
  };

  // ชื่อประชุมที่ใช้บ่อย ดึงอัตโนมัติจาก events เก่า เรียงตามความถี่ (มาก→น้อย)
  const titleSuggestions = useMemo(() => {
    const counts = new Map<string, { label: string; count: number; lastIndex: number }>();
    events.forEach((ev, index) => {
      if (evtToBool(ev.is_holiday)) return;
      const label = (ev.title || "").trim();
      if (!label) return;
      const key = label.toLowerCase();
      const existing = counts.get(key);
      if (existing) {
        existing.count += 1;
        existing.lastIndex = index;
      } else {
        counts.set(key, { label, count: 1, lastIndex: index });
      }
    });
    return Array.from(counts.values())
      .sort((a, b) => (b.count - a.count) || (b.lastIndex - a.lastIndex))
      .slice(0, 10)
      .map((item) => item.label);
  }, [events]);

  // กรองตามข้อความที่พิมพ์อยู่ (ถ้ามี) เพื่อให้ตัวเลือกตรงขึ้น
  const filteredTitleSuggestions = useMemo(() => {
    const q = title.trim().toLowerCase();
    if (!q) return titleSuggestions;
    return titleSuggestions.filter((s) => s.toLowerCase().includes(q) && s.toLowerCase() !== q);
  }, [title, titleSuggestions]);

  // ปิด dropdown เมื่อคลิกนอกช่องหัวข้อ
  useEffect(() => {
    if (!showTitleSuggestions) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (titleFieldRef.current && !titleFieldRef.current.contains(e.target as Node)) {
        setShowTitleSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showTitleSuggestions]);

  if (!isOpen) return null;

  const isHolidayForm = isHoliday || editingEvent?.is_holiday;
  const isDuplicating = !editingEvent && !!duplicatingEvent;
  const modalTitle = editingEvent
    ? (isHolidayForm ? "แก้ไขวันหยุด" : "แก้ไขกิจกรรมการประชุม")
    : isDuplicating
      ? (isHolidayForm ? "ทำซ้ำวันหยุด" : "ทำซ้ำกิจกรรมการประชุม")
      : (isHolidayForm ? "เพิ่มวันหยุดใหม่" : "เพิ่มกิจกรรมการประชุมใหม่");
  const submitLabel = editingEvent
    ? (isHolidayForm ? "บันทึกวันหยุด" : "บันทึกการแก้ไข")
    : (isHolidayForm ? "บันทึกวันหยุด" : "บันทึกกิจกรรม");

  const resolvedLocation = locationChoice === LOCATION_OTHER_VALUE ? customLocation.trim() : locationChoice;
  const isMultiDayForm = endDate && endDate !== date;
  const bookingCandidate = {
    id: editingEvent?.id || "",
    title,
    date,
    end_date: endDate || undefined,
    start_time: isMultiDayForm ? "" : startTime,
    end_time: isMultiDayForm ? "" : endTime,
    location: resolvedLocation.trim(),
    is_online: isOnline,
    online_resource: isOnline ? onlineResource : "",
    is_holiday: isHoliday,
  } as EventData;
  const bookingConflict = findBookingConflict(bookingCandidate, events);
  const locationBookingConflict = bookingConflict?.type === "location" ? bookingConflict : null;
  const onlineBookingConflict = bookingConflict?.type === "online_resource" ? bookingConflict : null;
  const resolvedOnlinePlatform = onlineResource === "office_zoom" ? "zoom" : onlineResource === "office_webex" ? "webex" : "";
  const shouldShowOnlineLink = isOnline && !onlineResource;

  const validate = () => {
    const isMultiDay = endDate && endDate !== date;
    const newErrors: { [key: string]: string } = {};
    if (!title.trim()) newErrors.title = "กรุณากรอกหัวข้อกิจกรรมการประชุม";
    if (!date) newErrors.date = "กรุณาระบุวันที่จัดกิจกรรม";
    if (endDate && endDate < date) newErrors.endDate = "วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น";
    if (!groupId || !groups.some((group) => group.id === groupId)) {
      newErrors.groupId = "กรุณาเลือกกลุ่มงานที่มีอยู่จริง";
    }
    if (!isHolidayForm && !isOnline && !resolvedLocation.trim()) {
      newErrors.location = "กรุณาเลือกหรือกรอกสถานที่จัดประชุม";
    }
    if (locationChoice === LOCATION_OTHER_VALUE && !customLocation.trim() && !isOnline && !isHolidayForm) {
      newErrors.location = "กรุณากรอกสถานที่จัดประชุมอื่นๆ";
    }
    if (bookingConflict) {
      newErrors.booking = `${bookingConflict.resourceName} ถูกจองแล้วในช่วงเวลาเดียวกัน: ${bookingConflict.event.title}`;
    }
    
    if (!isMultiDay) {
      if (!startTime) newErrors.startTime = "กรุณาระบุเวลาเริ่ม";
      if (!endTime) newErrors.endTime = "กรุณาระบุเวลาสิ้นสุด";
      if (startTime && endTime && startTime > endTime) {
        newErrors.endTime = "เวลาสิ้นสุดควรจะอยู่หลังเวลาเริ่ม";
      }
    }
    
    if (!createdBy.trim()) newErrors.createdBy = "กรุณาระบุชื่อผู้ลงบันทึก";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const isMultiDay = endDate && endDate !== date;

    await onSave({
      id: editingEvent?.id,
      title: title.trim(),
      description: description.trim(),
      date,
      end_date: endDate || undefined,
      start_time: isMultiDay ? "" : startTime,
      end_time: isMultiDay ? "" : endTime,
      group_id: groupId,
      location: resolvedLocation.trim(),
      is_online: isOnline,
      online_platform: isOnline ? resolvedOnlinePlatform : "",
      online_link: shouldShowOnlineLink ? onlineLink.trim() : getOnlineResourceLink(onlineResource),
      online_resource: isOnline ? onlineResource : "",
      is_holiday: isHoliday,
      created_by: createdBy.trim(),
    });
    
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div 
        id="event-form-dialog"
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col my-8"
      >
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-red-600 to-red-700 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            <h3 className="text-lg font-bold font-sans">
              {modalTitle}
            </h3>
          </div>
          <button 
            id="close-form-modal-btn"
            onClick={onClose} 
            className="text-white/80 hover:text-white hover:bg-white/10 rounded-lg p-1.5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 max-h-[75vh]">

          {/* Duplicate hint: prefilled from an existing event, just change the date */}
          {isDuplicating && (
            <div className="flex items-start gap-2 bg-indigo-50 border border-indigo-100 rounded-xl px-3.5 py-2.5">
              <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
              <p className="text-xs text-indigo-700 font-sans leading-relaxed">
                คัดลอกข้อมูลจากกิจกรรมเดิมมาให้แล้ว — แก้ไข<strong className="font-bold">วันที่</strong>ให้เป็นรอบใหม่ แล้วกดบันทึกเป็นกิจกรรมใหม่ได้เลย
              </p>
            </div>
          )}

          {/* Title */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 block">หัวข้อกิจกรรม / ชื่อการประชุม *</label>
            <div className="relative" ref={titleFieldRef}>
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (titleSuggestions.length > 0) setShowTitleSuggestions(true);
                }}
                onFocus={() => {
                  if (titleSuggestions.length > 0) setShowTitleSuggestions(true);
                }}
                placeholder="เช่น ประชุมคณะกรรมการบริหารประจำเดือน..."
                className={`w-full text-sm pl-3.5 py-2 border rounded-xl outline-none transition-all ${
                  titleSuggestions.length > 0 ? "pr-10" : "pr-3.5"
                } ${
                  errors.title ? "border-red-500 focus:ring-2 focus:ring-red-100" : "border-slate-200 focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                }`}
              />
              {titleSuggestions.length > 0 && (
                <button
                  type="button"
                  aria-label="เลือกชื่อประชุมที่ใช้บ่อย"
                  onClick={() => setShowTitleSuggestions((prev) => !prev)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform ${showTitleSuggestions ? "rotate-180" : ""}`} />
                </button>
              )}
              {showTitleSuggestions && filteredTitleSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-150 rounded-xl shadow-2xl py-1 z-50 max-h-56 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-150">
                  <p className="px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-sans">ชื่อที่ใช้บ่อย</p>
                  {filteredTitleSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => {
                        setTitle(suggestion);
                        setShowTitleSuggestions(false);
                        setErrors((prev) => ({ ...prev, title: "" }));
                      }}
                      className="w-full text-left text-sm px-3.5 py-2 text-slate-700 hover:bg-red-50 hover:text-red-600 transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {errors.title && <p className="text-xs text-red-500 font-sans">{errors.title}</p>}
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 block flex items-center gap-1">
              <AlignLeft className="w-3.5 h-3.5 text-slate-400" />
              รายละเอียดกิจกรรม
            </label>
            <textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="ระบุวัตถุประสงค์ วาระสำคัญ เอกสารประกอบ หรือรายชื่อผู้เข้าร่วมประชุม (ถ้ามี)"
              rows={3}
              className="w-full text-sm px-3.5 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all resize-none"
            />
          </div>

          {/* Date Picker */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1 relative">
              <label className="text-xs font-bold text-slate-700 block flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-red-500" />
                <span>วันเริ่มต้น *</span>
                <span className="text-[10px] text-slate-400 font-normal">(พ.ศ. ไทย)</span>
              </label>
              
              <button
                id="event-date-picker-trigger"
                type="button"
                onClick={() => setPickerType(pickerType === "start" ? null : "start")}
                className={`w-full flex items-center justify-between text-left text-sm px-3.5 py-2.5 border rounded-xl bg-white outline-none transition-all cursor-pointer hover:bg-slate-50/50 ${
                  errors.date ? "border-red-500 ring-2 ring-red-100" : "border-slate-200 focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                }`}
              >
                <span className="font-sans font-medium text-slate-800">
                  {date ? formatThaiDate(date) : "กรุณาเลือกวันเริ่มต้น..."}
                </span>
                <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
              </button>
              {errors.date && <p className="text-xs text-red-500 font-sans mt-0.5">{errors.date}</p>}
            </div>

            <div className="space-y-1 relative">
              <label className="text-xs font-bold text-slate-700 block flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>วันสิ้นสุด (ถ้ามี)</span>
                <span className="text-[10px] text-slate-400 font-normal">หลายวัน</span>
              </label>
              
              <button
                id="event-enddate-picker-trigger"
                type="button"
                onClick={() => {
                  setPickerType(pickerType === "end" ? null : "end");
                  if (!endDate) {
                    setEndDate(date); // Initialize with start date when opening
                  }
                }}
                className={`w-full flex items-center justify-between text-left text-sm px-3.5 py-2.5 border rounded-xl bg-white outline-none transition-all cursor-pointer hover:bg-slate-50/50 ${
                  errors.endDate ? "border-red-500 ring-2 ring-red-100" : "border-slate-200 focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                }`}
              >
                <span className={`font-sans font-medium ${endDate ? "text-slate-800" : "text-slate-400"}`}>
                  {endDate ? formatThaiDate(endDate) : "ไม่ได้ระบุ (วันเดียว)"}
                </span>
                {endDate ? (
                  <X 
                    className="w-4 h-4 text-slate-400 hover:text-red-500 shrink-0" 
                    onClick={(e) => { e.stopPropagation(); setEndDate(""); }}
                  />
                ) : (
                  <Calendar className="w-4 h-4 text-slate-300 shrink-0" />
                )}
              </button>
              {errors.endDate && <p className="text-xs text-red-500 font-sans mt-0.5">{errors.endDate}</p>}
            </div>
          </div>

          <div className="relative">
            {/* Click-outside backdrop overlay */}
            {pickerType && (
              <div 
                id="datepicker-backdrop-overlay"
                className="fixed inset-0 z-40 cursor-default" 
                onClick={() => setPickerType(null)}
              />
            )}

            {/* Premium Date Picker Popover */}
            {pickerType && (() => {
              const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
              const getFirstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();

              const daysInMonth = getDaysInMonth(pickerYear, pickerMonth);
              const firstDayIndex = getFirstDayOfMonth(pickerYear, pickerMonth);

              const prevMonthIndex = pickerMonth === 0 ? 11 : pickerMonth - 1;
              const prevMonthYear = pickerMonth === 0 ? pickerYear - 1 : pickerYear;
              const daysInPrevMonth = getDaysInMonth(prevMonthYear, prevMonthIndex);

              const blankDays = Array.from({ length: firstDayIndex }, (_, i) => {
                const dayNum = daysInPrevMonth - firstDayIndex + 1 + i;
                const mStr = String(prevMonthIndex + 1).padStart(2, '0');
                const dStr = String(dayNum).padStart(2, '0');
                return {
                  dayNum,
                  isCurrentMonth: false,
                  dateStr: `${prevMonthYear}-${mStr}-${dStr}`
                };
              });

              const monthDays = Array.from({ length: daysInMonth }, (_, i) => {
                const dayNum = i + 1;
                const mStr = String(pickerMonth + 1).padStart(2, '0');
                const dStr = String(dayNum).padStart(2, '0');
                return {
                  dayNum,
                  isCurrentMonth: true,
                  dateStr: `${pickerYear}-${mStr}-${dStr}`
                };
              });

              const remainingSlots = 42 - (blankDays.length + monthDays.length);
              const nextMonthDays = Array.from({ length: remainingSlots }, (_, i) => {
                const dayNum = i + 1;
                const nextMonthIndex = pickerMonth === 11 ? 0 : pickerMonth + 1;
                const nextMonthYear = pickerMonth === 11 ? pickerYear + 1 : pickerYear;
                const mStr = String(nextMonthIndex + 1).padStart(2, '0');
                const dStr = String(dayNum).padStart(2, '0');
                return {
                  dayNum,
                  isCurrentMonth: false,
                  dateStr: `${nextMonthYear}-${mStr}-${dStr}`
                };
              });

              const calendarDays = [...blankDays, ...monthDays, ...nextMonthDays];
              
              const THAI_MONTHS_LONG = [
                "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
                "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
              ];

              const handlePrevPickerMonth = () => {
                if (pickerMonth === 0) {
                  setPickerMonth(11);
                  setPickerYear(prev => prev - 1);
                } else {
                  setPickerMonth(prev => prev - 1);
                }
              };

              const handleNextPickerMonth = () => {
                if (pickerMonth === 11) {
                  setPickerMonth(0);
                  setPickerYear(prev => prev + 1);
                } else {
                  setPickerMonth(prev => prev + 1);
                }
              };

              return (
                <div 
                  id="event-datepicker-popover"
                  className="absolute left-0 right-0 sm:right-auto sm:w-80 bg-white border border-slate-150 rounded-2xl shadow-2xl p-4 mt-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                >
                  {/* Popover Header */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <button
                      id="datepicker-prev-month-btn"
                      type="button"
                      onClick={handlePrevPickerMonth}
                      className="p-1.5 border border-slate-200 hover:border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-slate-800 font-sans">
                        {THAI_MONTHS_LONG[pickerMonth]}
                      </span>
                      <span className="text-sm font-semibold text-slate-500 font-sans">
                        {pickerYear + 543}
                      </span>
                    </div>

                    <button
                      id="datepicker-next-month-btn"
                      type="button"
                      onClick={handleNextPickerMonth}
                      className="p-1.5 border border-slate-200 hover:border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Weekdays Labels */}
                  <div className="grid grid-cols-7 text-center mb-1.5">
                    {["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"].map((w, idx) => (
                      <span 
                        key={w} 
                        className={`text-[10px] font-bold uppercase tracking-wider font-sans ${
                          idx === 0 ? "text-red-500" : "text-slate-400"
                        }`}
                      >
                        {w}
                      </span>
                    ))}
                  </div>

                  {/* Days Grid */}
                  <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map((cell, idx) => {
                      const isSelected = cell.dateStr === date;
                      const isToday = cell.dateStr === new Date().toISOString().split("T")[0];
                      return (
                        <button
                          id={`datepicker-day-${cell.dateStr}`}
                          key={`${cell.dateStr}-${idx}`}
                          type="button"
                          onClick={() => {
                            if (pickerType === "start") setDate(cell.dateStr);
                            else if (pickerType === "end") setEndDate(cell.dateStr);
                            setPickerType(null);
                          }}
                          className={`aspect-square rounded-lg flex items-center justify-center text-xs font-sans transition-all cursor-pointer ${
                            (pickerType === "start" ? cell.dateStr === date : cell.dateStr === endDate)
                              ? "bg-red-600 text-white font-bold shadow-md shadow-red-600/20" 
                              : isToday
                                ? "bg-red-50 text-red-600 font-bold border border-red-100"
                                : cell.isCurrentMonth
                                  ? idx % 7 === 0 // Sunday
                                    ? "text-red-600 font-semibold hover:bg-slate-50"
                                    : "text-slate-700 font-medium hover:bg-slate-50"
                                  : "text-slate-300 hover:bg-slate-50/50"
                          }`}
                        >
                          {cell.dayNum}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Time Picker Row */}
          {(() => {
            const isMultiDay = endDate && endDate !== date;

            if (isMultiDay) {
              return (
                <div className="flex items-center gap-3 p-4 bg-emerald-50 text-emerald-800 rounded-2xl border border-emerald-100 text-sm font-sans font-medium">
                  <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-bold text-emerald-900 text-xs sm:text-sm">ประชุมแบบหลายวัน (ต่อเนื่อง)</p>
                    <p className="text-emerald-700 text-[11px] sm:text-xs">กำหนดจัดกิจกรรมตลอดทั้งวัน (ไม่จำเป็นต้องระบุเวลา)</p>
                  </div>
                </div>
              );
            }

            const [startH, startM] = (startTime || "09:00").split(":");
            const [endH, endM] = (endTime || "12:00").split(":");

            const getDurationText = () => {
              const sH = parseInt(startH, 10);
              const sM = parseInt(startM, 10);
              const eH = parseInt(endH, 10);
              const eM = parseInt(endM, 10);
              
              const totalStartMins = sH * 60 + sM;
              const totalEndMins = eH * 60 + eM;
              
              if (totalEndMins < totalStartMins) {
                return null; // Warning state handled below
              }
              
              const diff = totalEndMins - totalStartMins;
              const hrs = Math.floor(diff / 60);
              const mins = diff % 60;
              
              const hrsText = hrs > 0 ? `${hrs} ชั่วโมง` : "";
              const minsText = mins > 0 ? `${mins} นาที` : "";
              if (diff === 0) return "0 นาที";
              return [hrsText, minsText].filter(Boolean).join(" ");
            };

            const durationText = getDurationText();
            const hasTimeError = startTime && endTime && startTime > endTime;

            return (
              <div className="space-y-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <Clock className="w-3.5 h-3.5 text-red-500" />
                    <span>เวลาดำเนินงาน (ระบบ 24 ชั่วโมง) *</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-50 text-red-600 border border-red-100">
                    24-HOUR FORMAT
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Start Time Selectors */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 block">เวลาเริ่มต้น</span>
                    <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2 py-1.5 focus-within:ring-2 focus-within:ring-red-500/20 focus-within:border-red-500 transition-all">
                      <select 
                        id="event-start-hour-select"
                        value={startH || "09"}
                        onChange={(e) => setStartTime(`${e.target.value}:${startM || "00"}`)}
                        className="flex-1 text-sm bg-transparent outline-none cursor-pointer text-slate-800 font-medium py-0.5 appearance-none text-center"
                      >
                        {Array.from({ length: 24 }, (_, i) => {
                          const h = String(i).padStart(2, '0');
                          return <option key={h} value={h}>{h}</option>;
                        })}
                      </select>
                      <span className="text-slate-400 font-bold px-0.5">:</span>
                      <select 
                        id="event-start-minute-select"
                        value={startM || "00"}
                        onChange={(e) => setStartTime(`${startH || "09"}:${e.target.value}`)}
                        className="flex-1 text-sm bg-transparent outline-none cursor-pointer text-slate-800 font-medium py-0.5 appearance-none text-center"
                      >
                        {Array.from({ length: 60 }, (_, i) => {
                          const m = String(i).padStart(2, '0');
                          return <option key={m} value={m}>{m}</option>;
                        })}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
                    </div>
                  </div>

                  {/* End Time Selectors */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 block">เวลาสิ้นสุด</span>
                    <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2 py-1.5 focus-within:ring-2 focus-within:ring-red-500/20 focus-within:border-red-500 transition-all">
                      <select 
                        id="event-end-hour-select"
                        value={endH || "12"}
                        onChange={(e) => setEndTime(`${e.target.value}:${endM || "00"}`)}
                        className="flex-1 text-sm bg-transparent outline-none cursor-pointer text-slate-800 font-medium py-0.5 appearance-none text-center"
                      >
                        {Array.from({ length: 24 }, (_, i) => {
                          const h = String(i).padStart(2, '0');
                          return <option key={h} value={h}>{h}</option>;
                        })}
                      </select>
                      <span className="text-slate-400 font-bold px-0.5">:</span>
                      <select 
                        id="event-end-minute-select"
                        value={endM || "00"}
                        onChange={(e) => setEndTime(`${endH || "12"}:${e.target.value}`)}
                        className="flex-1 text-sm bg-transparent outline-none cursor-pointer text-slate-800 font-medium py-0.5 appearance-none text-center"
                      >
                        {Array.from({ length: 60 }, (_, i) => {
                          const m = String(i).padStart(2, '0');
                          return <option key={m} value={m}>{m}</option>;
                        })}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
                    </div>
                  </div>
                </div>

                {/* Error or Live Duration Alert */}
                {hasTimeError ? (
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-red-600 bg-red-50/50 px-2.5 py-1.5 rounded-lg border border-red-100">
                    <Info className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    <span>แจ้งเตือน: เวลาสิ้นสุดจัดประชุม ควรอยู่หลังเวลาเริ่มต้น</span>
                  </div>
                ) : durationText ? (
                  <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-slate-600 bg-white/80 px-2.5 py-1.5 rounded-lg border border-slate-100 shadow-sm/5">
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>ระยะเวลารวม: <strong className="text-slate-800 font-bold">{durationText}</strong></span>
                  </div>
                ) : null}

                {(errors.startTime || errors.endTime) && (
                  <p className="text-xs text-red-500 font-sans mt-0.5">
                    {errors.startTime || errors.endTime}
                  </p>
                )}
              </div>
            );
          })()}

          {/* Group / Department Select */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 block">กลุ่มงาน / กองสังกัดเจ้าภาพ *</label>
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="w-full text-sm px-3.5 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all bg-white"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.label})
                </option>
              ))}
            </select>
            {errors.groupId && <p className="text-xs text-red-500 font-sans">{errors.groupId}</p>}
          </div>

          {/* Location field */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 block flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              สถานที่จัดประชุม
            </label>
            <select
              value={locationChoice}
              onChange={(e) => {
                setLocationChoice(e.target.value);
                if (e.target.value !== LOCATION_OTHER_VALUE) {
                  setCustomLocation("");
                }
              }}
              className={`w-full text-sm px-3.5 py-2 border rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all bg-white ${
                errors.location ? "border-red-500" : "border-slate-200"
              }`}
            >
              <option value="">ไม่ระบุสถานที่ / ประชุมออนไลน์เท่านั้น</option>
              <optgroup label="ห้องประชุมสำนักงาน">
                {OFFICE_BOOKABLE_ROOMS.map((room) => (
                  <option key={room} value={room}>{room}</option>
                ))}
              </optgroup>
              <optgroup label="ห้องประชุมภายนอก">
                {EXTERNAL_ROOMS.map((room) => (
                  <option key={room} value={room}>{room}</option>
                ))}
              </optgroup>
              <option value={LOCATION_OTHER_VALUE}>อื่นๆ</option>
            </select>
            {locationChoice === LOCATION_OTHER_VALUE && (
              <input
                type="text"
                value={customLocation}
                onChange={(e) => setCustomLocation(e.target.value)}
                placeholder="กรอกสถานที่จัดประชุมอื่นๆ"
                className={`w-full text-sm px-3.5 py-2 border rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all ${
                  errors.location ? "border-red-500" : "border-slate-200"
                }`}
              />
            )}
            {errors.location && <p className="text-xs text-red-500 font-sans">{errors.location}</p>}
            {isOfficeBookableRoom(resolvedLocation) && !isHolidayForm && (
              <p className={`text-xs font-sans ${locationBookingConflict ? "text-red-600" : "text-emerald-600"}`}>
                {locationBookingConflict
                  ? `${locationBookingConflict.resourceName} ถูกจองแล้ว: ${locationBookingConflict.event.title}`
                  : `${resolvedLocation} ว่างในช่วงเวลานี้`}
              </p>
            )}
          </div>

          {/* Online & Holiday Toggle Buttons Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            
            {/* Online Toggle Switch */}
            <div className="flex items-center justify-between p-3 border border-slate-100 bg-slate-50 rounded-xl">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-700 block">รูปแบบออนไลน์ (Online)</span>
                <span className="text-[10px] text-slate-400 font-sans block">ใช้การประชุมผ่าน Video Call</span>
              </div>
              <button
                id="online-meeting-toggle"
                type="button"
                onClick={() => {
                  const nextIsOnline = !isOnline;
                  setIsOnline(nextIsOnline);
                  if (!nextIsOnline) {
                    setOnlineLink("");
                    setOnlineResource("");
                  }
                }}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                  isOnline ? "bg-emerald-500" : "bg-slate-350"
                }`}
              >
                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${isOnline ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>

            {/* Holiday Toggle Switch */}
            <div className="flex items-center justify-between p-3 border border-slate-100 bg-slate-50 rounded-xl">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-700 block">ระบุเป็นวันหยุด (Holiday)</span>
                <span className="text-[10px] text-slate-400 font-sans block">แสดงป้ายวันหยุดสีแดงในปฏิทิน</span>
              </div>
              <button
                id="holiday-flag-toggle"
                type="button"
                onClick={() => setIsHoliday(!isHoliday)}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                  isHoliday ? "bg-red-500" : "bg-slate-350"
                }`}
              >
                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${isHoliday ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>

            {/* Online Meeting */}
            {isOnline && (
              <div className="col-span-1 sm:col-span-2 p-3.5 border border-slate-150 bg-slate-50/50 rounded-2xl space-y-2.5 animate-in fade-in slide-in-from-top-1.5 duration-150">
                <div className="space-y-2 pt-1">
                  <span className="text-xs font-bold text-slate-700 block">การประชุมออนไลน์</span>
                  <div className="grid grid-cols-1 gap-2">
                    {ONLINE_RESOURCES.map((resource) => {
                      const isSelected = onlineResource === resource.id;
                      return (
                        <button
                          id={`online-resource-${resource.id || "none"}-btn`}
                          key={resource.id || "none"}
                          type="button"
                          onClick={() => {
                            setOnlineResource(resource.id);
                            if (resource.id) {
                              setOnlineLink("");
                            }
                          }}
                          className={`text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
                            isSelected
                              ? "bg-red-50 border-red-200 text-red-800"
                              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50/80 hover:border-slate-300"
                          }`}
                        >
                          <span className="block text-xs font-bold font-sans">{resource.label}</span>
                          <span className="block text-[10px] text-slate-500 font-sans mt-0.5">{resource.description}</span>
                        </button>
                      );
                    })}
                  </div>
                  {onlineResource && !isHolidayForm && (
                    <p className={`text-xs font-sans ${onlineBookingConflict ? "text-red-600" : "text-emerald-600"}`}>
                      {onlineBookingConflict
                        ? `${onlineBookingConflict.resourceName} ถูกจองแล้ว: ${onlineBookingConflict.event.title}`
                        : `${getOnlineResourceLabel(onlineResource)} ว่างในช่วงเวลานี้${getOnlineResourceDescription(onlineResource) ? ` (${getOnlineResourceDescription(onlineResource)})` : ""}`}
                    </p>
                  )}
                </div>
                {shouldShowOnlineLink && (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 block">ลิงก์การประชุมออนไลน์</label>
                    <input
                      type="text"
                      value={onlineLink}
                      onChange={(e) => setOnlineLink(e.target.value)}
                      placeholder="วางลิงก์ Zoom / Webex"
                      className="w-full text-sm px-3.5 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all bg-white"
                    />
                  </div>
                )}
              </div>
            )}
            {errors.booking && <p className="col-span-1 sm:col-span-2 text-xs text-red-500 font-sans">{errors.booking}</p>}

          </div>

          {/* Created By */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 block flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-slate-400" />
              ชื่อข้าราชการ / เจ้าหน้าที่ผู้ลงบันทึก *
            </label>
            <input 
              type="text"
              value={createdBy}
              onChange={(e) => setCreatedBy(e.target.value)}
              placeholder="เช่น นายศักดิ์ดา อัครเดชา"
              className={`w-full text-sm px-3.5 py-2 border rounded-xl outline-none transition-all ${
                errors.createdBy ? "border-red-500 focus:ring-2 focus:ring-red-100" : "border-slate-200 focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
              }`}
            />
            {errors.createdBy && <p className="text-xs text-red-500 font-sans">{errors.createdBy}</p>}
          </div>

        </form>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 shrink-0">
          <button
            id="cancel-form-btn"
            type="button"
            onClick={onClose}
            className="text-sm px-4 py-2 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-semibold transition-colors"
          >
            ยกเลิก
          </button>
          <button
            id="submit-form-btn"
            type="submit"
            onClick={handleSubmit}
            disabled={!!bookingConflict}
            className={`text-sm px-6 py-2 rounded-xl text-white font-semibold shadow-md shadow-red-600/15 transition-all ${
              bookingConflict ? "bg-slate-300 cursor-not-allowed shadow-none" : "bg-red-600 hover:bg-red-700"
            }`}
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
