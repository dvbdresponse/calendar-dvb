import { useState, useEffect, FormEvent } from "react";
import { X, Calendar, Clock, MapPin, AlignLeft, User, Info, Check, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { EventData, Group } from "../types";

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
  selectedDate: string; // Prepopulates when creating
  editingEvent: EventData | null; // Prepopulates when editing
  currentUserName?: string;
  onSave: (event: Omit<EventData, "id" | "created_at"> & { id?: string }) => void | Promise<void>;
}

export default function EventFormModal({
  isOpen,
  onClose,
  groups,
  selectedDate,
  editingEvent,
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
  const [location, setLocation] = useState("");
  const [isOnline, setIsOnline] = useState(false);
  const [onlinePlatform, setOnlinePlatform] = useState("zoom");
  const [isHoliday, setIsHoliday] = useState(false);
  const [createdBy, setCreatedBy] = useState("");
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const [pickerYear, setPickerYear] = useState(2026);
  const [pickerMonth, setPickerMonth] = useState(6); // July
  const [pickerType, setPickerType] = useState<"start" | "end" | null>(null);

  useEffect(() => {
    if (isOpen) {
      let initialDate = "";
      if (editingEvent) {
        setTitle(editingEvent.title);
        setDescription(editingEvent.description || "");
        initialDate = editingEvent.date;
        setDate(editingEvent.date);
        setEndDate(editingEvent.end_date || "");
        setStartTime(editingEvent.start_time);
        setEndTime(editingEvent.end_time);
        setGroupId(editingEvent.group_id);
        setLocation(editingEvent.location || "");
        setIsOnline(evtToBool(editingEvent.is_online));
        setOnlinePlatform(editingEvent.online_platform || "zoom");
        setIsHoliday(evtToBool(editingEvent.is_holiday));
        setCreatedBy(editingEvent.created_by || "");
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
        setLocation("");
        setIsOnline(false);
        setOnlinePlatform("zoom");
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
  }, [isOpen, editingEvent, selectedDate, currentUserName, groups]);

  const evtToBool = (val: any): boolean => {
    if (typeof val === "boolean") return val;
    return val === "true" || val === 1 || val === "1";
  };

  if (!isOpen) return null;

  const isHolidayForm = isHoliday || editingEvent?.is_holiday;
  const modalTitle = editingEvent
    ? (isHolidayForm ? "แก้ไขวันหยุด" : "แก้ไขกิจกรรมการประชุม")
    : (isHolidayForm ? "เพิ่มวันหยุดใหม่" : "เพิ่มกิจกรรมการประชุมใหม่");
  const submitLabel = editingEvent
    ? (isHolidayForm ? "บันทึกวันหยุด" : "บันทึกการแก้ไข")
    : (isHolidayForm ? "บันทึกวันหยุด" : "บันทึกกิจกรรม");

  const validate = () => {
    const isMultiDay = endDate && endDate !== date;
    const newErrors: { [key: string]: string } = {};
    if (!title.trim()) newErrors.title = "กรุณากรอกหัวข้อกิจกรรมการประชุม";
    if (!date) newErrors.date = "กรุณาระบุวันที่จัดกิจกรรม";
    if (endDate && endDate < date) newErrors.endDate = "วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น";
    if (!groupId || !groups.some((group) => group.id === groupId)) {
      newErrors.groupId = "กรุณาเลือกกลุ่มงานที่มีอยู่จริง";
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
      location: location.trim(),
      is_online: isOnline,
      online_platform: isOnline ? onlinePlatform : "",
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
          
          {/* Title */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 block">หัวข้อกิจกรรม / ชื่อการประชุม *</label>
            <input 
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="เช่น ประชุมคณะกรรมการบริหารประจำเดือน..."
              className={`w-full text-sm px-3.5 py-2 border rounded-xl outline-none transition-all ${
                errors.title ? "border-red-500 focus:ring-2 focus:ring-red-100" : "border-slate-200 focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
              }`}
            />
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
              สถานที่จัดประชุม / ลิงก์ออนไลน์ *
            </label>
            <input 
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="ระบุชื่อห้องประชุม อาคาร หรือลิงก์ Zoom/Teams"
              className="w-full text-sm px-3.5 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all"
            />
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
                onClick={() => setIsOnline(!isOnline)}
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

            {/* Online Platform Selector */}
            {isOnline && (
              <div className="col-span-1 sm:col-span-2 p-3.5 border border-slate-150 bg-slate-50/50 rounded-2xl space-y-2.5 animate-in fade-in slide-in-from-top-1.5 duration-150">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 block">ช่องทางการประชุมออนไลน์ (Online Platform) *</span>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">
                    ระบบจะเลือกแอปพลิเคชันหลักให้
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: "zoom", label: "Zoom" },
                    { id: "webex", label: "Cisco Webex" },
                    { id: "teams", label: "MS Teams" },
                    { id: "meet", label: "Google Meet" }
                  ].map((platform) => {
                    const isSelected = onlinePlatform === platform.id;
                    return (
                      <button
                        id={`platform-${platform.id}-btn`}
                        key={platform.id}
                        type="button"
                        onClick={() => setOnlinePlatform(platform.id)}
                        className={`py-2 px-2.5 text-xs font-bold rounded-xl border text-center transition-all cursor-pointer ${
                          isSelected
                            ? "bg-red-600 border-red-600 text-white shadow-sm"
                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50/80 hover:border-slate-300"
                        }`}
                      >
                        <span className="font-sans">{platform.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

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
            className="text-sm px-6 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold shadow-md shadow-red-600/15 transition-all"
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
