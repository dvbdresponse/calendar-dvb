import { useState, useMemo } from "react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell 
} from "recharts";
import { 
  BarChart3, 
  TrendingUp, 
  Video, 
  MapPin, 
  Users, 
  ChevronDown, 
  ChevronUp, 
  Calendar,
  Sparkles,
  Award
} from "lucide-react";
import { EventData, Group } from "../types";

interface MeetingStatsDashboardProps {
  events: EventData[];
  groups: Group[];
}

export default function MeetingStatsDashboard({ events, groups }: MeetingStatsDashboardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [timeframe, setTimeframe] = useState<"monthly" | "weekly">("monthly");

  // Only consider actual business/work meetings (not holidays) for statistics
  const actualMeetings = useMemo(() => {
    return events.filter(e => !e.is_holiday);
  }, [events]);

  // Calculate high-level summary statistics
  const stats = useMemo(() => {
    const total = actualMeetings.length;
    const online = actualMeetings.filter(e => e.is_online).length;
    const onsite = total - online;
    const onlinePercentage = total > 0 ? Math.round((online / total) * 100) : 0;
    
    // Find group with highest meeting count
    const groupCounts: { [key: string]: number } = {};
    actualMeetings.forEach(e => {
      groupCounts[e.group_id] = (groupCounts[e.group_id] || 0) + 1;
    });

    let maxGroupId = "";
    let maxCount = 0;
    Object.entries(groupCounts).forEach(([gid, count]) => {
      if (count > maxCount) {
        maxCount = count;
        maxGroupId = gid;
      }
    });

    const busiestGroup = groups.find(g => g.id === maxGroupId);

    return {
      total,
      online,
      onsite,
      onlinePercentage,
      busiestGroup: busiestGroup ? {
        name: busiestGroup.name,
        label: busiestGroup.label,
        color: busiestGroup.color,
        count: maxCount,
        bgColor: busiestGroup.bgColor,
        textColor: busiestGroup.textColor,
        borderColor: busiestGroup.borderColor
      } : null
    };
  }, [actualMeetings]);

  // Generate monthly stats
  const monthlyChartData = useMemo(() => {
    const monthsThai = [
      "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
      "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
    ];

    const data = monthsThai.map((m) => ({
      name: m,
      "จำนวนครั้ง": 0,
    }));

    actualMeetings.forEach(evt => {
      if (!evt.date) return;
      const parts = evt.date.split("-");
      if (parts.length === 3) {
        const monthIdx = parseInt(parts[1], 10) - 1;
        if (monthIdx >= 0 && monthIdx < 12) {
          data[monthIdx]["จำนวนครั้ง"] += 1;
        }
      }
    });

    return data;
  }, [actualMeetings]);

  // Generate weekly stats (Workday workload density)
  const weeklyChartData = useMemo(() => {
    const daysThai = [
      { key: "อา.", name: "วันอาทิตย์", color: "#EF4444" },
      { key: "จ.", name: "วันจันทร์", color: "#EAB308" },
      { key: "อ.", name: "วันอังคาร", color: "#EC4899" },
      { key: "พ.", name: "วันพุธ", color: "#10B981" },
      { key: "พฤ.", name: "วันพฤหัสบดี", color: "#F97316" },
      { key: "ศ.", name: "วันศุกร์", color: "#3B82F6" },
      { key: "ส.", name: "วันเสาร์", color: "#8B5CF6" }
    ];

    const data = daysThai.map(d => ({
      name: d.key,
      fullName: d.name,
      "จำนวนครั้ง": 0,
      color: d.color
    }));

    actualMeetings.forEach(evt => {
      if (!evt.date) return;
      const parts = evt.date.split("-");
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        const dateObj = new Date(y, m, d);
        const dayIdx = dateObj.getDay(); // 0-6
        if (dayIdx >= 0 && dayIdx < 7) {
          data[dayIdx]["จำนวนครั้ง"] += 1;
        }
      }
    });

    return data;
  }, [actualMeetings]);

  const activeChartData = timeframe === "monthly" ? monthlyChartData : weeklyChartData;

  // Custom Tooltip component for beautiful visual style
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const value = payload[0].value;
      const detailName = timeframe === "weekly" 
        ? weeklyChartData.find(d => d.name === label)?.fullName || label 
        : `เดือน${label}`;

      return (
        <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl shadow-xl text-white font-sans text-xs">
          <p className="font-bold text-[13px] text-red-400 mb-1">{detailName}</p>
          <div className="flex items-center gap-1.5 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>มีการจัดประชุม: <strong className="text-white text-sm font-bold">{value}</strong> ครั้ง</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-6 transition-all duration-300">
      
      {/* Header Bar */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-4 sm:px-6 py-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-red-50 text-red-600 rounded-xl">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 font-sans flex items-center gap-1.5">
              <span>รายงานวิเคราะห์สถิติวาระงานและปริมาณการประชุม</span>
              <span className="text-[10px] bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                Recharts Live
              </span>
            </h3>
            <p className="text-xs text-slate-400 font-sans mt-0.5">
              สรุปสถิติเพื่อสะท้อนภาระงาน (Workload) และการจัดสรรเวลาของหน่วยงานราชการแบบเรียลไทม์
            </p>
          </div>
        </div>

        <button 
          id="toggle-stats-dashboard-btn"
          type="button"
          className="p-1.5 border border-slate-200 hover:border-slate-300 rounded-xl bg-white text-slate-500 hover:text-slate-800 transition-all"
        >
          {isExpanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Stats Body with Slide-down simulation */}
      {isExpanded && (
        <div className="p-4 sm:p-6 space-y-6 animate-in fade-in duration-200">
          
          {/* Key Metric Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Card 1: Total Meetings */}
            <div className="bg-slate-50/55 p-4 rounded-xl border border-slate-100 flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans block">
                  จำนวนการประชุมรวม
                </span>
                <p className="text-2xl font-black text-slate-800 font-sans">
                  {stats.total} <span className="text-xs text-slate-400 font-medium">ครั้ง</span>
                </p>
                <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-sans font-semibold mt-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>บันทึกวาระงานเรียบร้อย</span>
                </div>
              </div>
              <div className="p-2 bg-red-50 text-red-600 rounded-lg">
                <Calendar className="w-4 h-4" />
              </div>
            </div>

            {/* Card 2: Online Meetings */}
            <div className="bg-slate-50/55 p-4 rounded-xl border border-slate-100 flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans block">
                  ประชุมผ่านช่องทางออนไลน์
                </span>
                <p className="text-2xl font-black text-emerald-600 font-sans">
                  {stats.online} <span className="text-xs text-slate-400 font-medium">ครั้ง</span>
                </p>
                <div className="flex items-center gap-1 text-[11px] text-slate-500 font-sans mt-1">
                  <span>คิดเป็นอัตราส่วน </span>
                  <strong className="text-emerald-600 font-bold">{stats.onlinePercentage}%</strong>
                </div>
              </div>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                <Video className="w-4 h-4" />
              </div>
            </div>

            {/* Card 3: Onsite Meetings */}
            <div className="bg-slate-50/55 p-4 rounded-xl border border-slate-100 flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans block">
                  ประชุม ณ สถานที่ (On-site)
                </span>
                <p className="text-2xl font-black text-blue-600 font-sans">
                  {stats.onsite} <span className="text-xs text-slate-400 font-medium">ครั้ง</span>
                </p>
                <div className="flex items-center gap-1 text-[11px] text-slate-500 font-sans mt-1">
                  <span>ตรวจพิกัดอาคารสำนักงาน</span>
                </div>
              </div>
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <MapPin className="w-4 h-4" />
              </div>
            </div>

            {/* Card 4: Busiest Group */}
            <div className="bg-slate-50/55 p-4 rounded-xl border border-slate-100 flex items-start justify-between">
              <div className="space-y-1.5 flex-1 min-w-0">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans block">
                  หน่วยงานที่ประชุมถี่สุด
                </span>
                {stats.busiestGroup ? (
                  <>
                    <p className="text-[14px] font-bold text-slate-800 font-sans truncate" title={stats.busiestGroup.name}>
                      {stats.busiestGroup.name}
                    </p>
                    <span className={`inline-block font-bold px-2 py-0.5 rounded text-[10px] border mt-1 ${stats.busiestGroup.bgColor} ${stats.busiestGroup.textColor} ${stats.busiestGroup.borderColor}`}>
                      {stats.busiestGroup.label} — {stats.busiestGroup.count} ครั้ง
                    </span>
                  </>
                ) : (
                  <p className="text-sm font-semibold text-slate-400 font-sans py-1">
                    ยังไม่มีข้อมูลกิจกรรม
                  </p>
                )}
              </div>
              <div className="p-2 bg-purple-50 text-purple-600 rounded-lg shrink-0 ml-2">
                <Users className="w-4 h-4" />
              </div>
            </div>

          </div>

          {/* Chart Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Recharts Bar Chart Panel */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-600" />
                  <span className="text-xs font-bold text-slate-700 font-sans">
                    แผนภูมิแสดงจำนวนการประชุมสะสม
                  </span>
                </div>

                {/* Switch View Toggle */}
                <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200/60 shadow-inner">
                  <button
                    id="stats-timeframe-monthly-btn"
                    type="button"
                    onClick={() => setTimeframe("monthly")}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all duration-150 cursor-pointer ${
                      timeframe === "monthly"
                        ? "bg-white text-slate-800 shadow-sm border border-slate-200"
                        : "text-slate-500 hover:text-slate-800 border border-transparent"
                    }`}
                  >
                    สรุปรายเดือน
                  </button>
                  <button
                    id="stats-timeframe-weekly-btn"
                    type="button"
                    onClick={() => setTimeframe("weekly")}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all duration-150 cursor-pointer ${
                      timeframe === "weekly"
                        ? "bg-white text-slate-800 shadow-sm border border-slate-200"
                        : "text-slate-500 hover:text-slate-800 border border-transparent"
                    }`}
                  >
                    ความหนาแน่นรายวัน (สัปดาห์)
                  </button>
                </div>
              </div>

              {/* Responsive BarChart Container */}
              <div className="h-64 w-full bg-slate-50/30 p-2 sm:p-4 border border-slate-100 rounded-xl">
                {actualMeetings.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 font-sans text-xs">
                    <span>ไม่มีข้อมูลกิจกรรมเพื่อสร้างกราฟสถิติ</span>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={activeChartData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="name" 
                        stroke="#94a3b8" 
                        fontSize={10} 
                        fontWeight={600}
                        tickLine={false}
                        axisLine={false}
                        dy={8}
                      />
                      <YAxis 
                        stroke="#94a3b8" 
                        fontSize={10} 
                        fontWeight={600}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip 
                        content={<CustomTooltip />}
                        cursor={{ fill: '#f8fafc', opacity: 0.6 }}
                      />
                      <Bar 
                        dataKey="จำนวนครั้ง" 
                        fill="#dc2626" 
                        radius={[6, 6, 0, 0]} 
                        maxBarSize={38}
                      >
                        {timeframe === "weekly" && weeklyChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Department Breakdown Column */}
            <div className="bg-slate-50/50 rounded-xl p-4 sm:p-5 border border-slate-100 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 border-b border-slate-200/60 pb-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-bold text-slate-700 font-sans">
                    สัดส่วนงานประชุมแยกตามฝ่าย/กอง
                  </span>
                </div>

                <div className="space-y-2.5 max-h-[160px] overflow-y-auto pr-1 no-scrollbar">
                  {groups.map((g) => {
                    const groupMeetingsCount = actualMeetings.filter(e => e.group_id === g.id).length;
                    const percent = stats.total > 0 ? Math.round((groupMeetingsCount / stats.total) * 100) : 0;

                    return (
                      <div key={g.id} className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-sans">
                          <span className="font-semibold text-slate-700 truncate max-w-[150px]">{g.name}</span>
                          <span className="font-bold text-slate-900">{groupMeetingsCount} ครั้ง ({percent}%)</span>
                        </div>
                        {/* Progress Bar */}
                        <div className="w-full bg-slate-200/60 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className="h-full rounded-full transition-all duration-500"
                            style={{ 
                              width: `${percent}%`,
                              backgroundColor: g.color
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Informative Banner */}
              <div className="bg-white border border-slate-200/60 rounded-xl p-3 flex items-start gap-2.5 shadow-sm/5 text-[11px] text-slate-500 leading-normal font-sans">
                <Award className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>
                  <strong>การวิเคราะห์เบื้องต้น:</strong> แผนภูมิแท่งสะสมช่วยให้ผู้จัดตารางประชุมสามารถตรวจสอบปริมาณงานที่ทับซ้อนในแต่ละช่วงเวลาได้อย่างมีประสิทธิภาพสูงสุด
                </span>
              </div>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}
