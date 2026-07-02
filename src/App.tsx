import { useState, useEffect, useCallback } from "react";
import { Info, Database, AlertCircle, Wifi, CloudLightning, RefreshCw, Layers, Calendar, BarChart3 } from "lucide-react";
import { EventData, SupabaseConfig, UserSession, Group } from "./types";
import { MOCK_EVENTS, GROUPS as INITIAL_GROUPS } from "./data/constants";
import { getSupabaseConfig, saveSupabaseConfig, createDynamicSupabaseClient } from "./utils/supabaseClient";

// Import custom components
import Header from "./components/Header";
import CalendarView from "./components/CalendarView";
import EventFormModal from "./components/EventFormModal";
import SupabaseConfigModal from "./components/SupabaseConfigModal";
import MeetingStatsDashboard from "./components/MeetingStatsDashboard";
import LoginModal from "./components/LoginModal";
import GroupManagerModal from "./components/GroupManagerModal";

export default function App() {
  const [events, setEvents] = useState<EventData[]>([]);
  const [groups, setGroups] = useState<Group[]>(() => {
    const savedGroups = localStorage.getItem("gov_calendar_groups");
    return savedGroups ? JSON.parse(savedGroups) : INITIAL_GROUPS;
  });
  
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });
  
  // User Session & Login state
  const [user, setUser] = useState<UserSession | null>(() => {
    const saved = localStorage.getItem("gov_calendar_user_session");
    return saved ? JSON.parse(saved) : null;
  });
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  
  // Active Tab View State (Calendar vs Analytics Dashboard)
  const [activeTab, setActiveTab] = useState<"calendar" | "analytics">("calendar");
  
  // Filtering & Search state
  const [searchTerm, setSearchTerm] = useState("");
  const [activeGroupFilters, setActiveGroupFilters] = useState<string[]>([]);
  
  // Connection / Config states
  const [supabaseConfig, setSupabaseConfigState] = useState<SupabaseConfig | null>(getSupabaseConfig());
  const [isDbLoading, setIsDbLoading] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  // Modal toggle states
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isGroupManagerModalOpen, setIsGroupManagerModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventData | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Toast state
  const [toasts, setToasts] = useState<{ id: string; message: string; type: "success" | "error" | "info" }[]>([]);

  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "success") => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const handleLoginSuccess = (session: UserSession) => {
    setUser(session);
    localStorage.setItem("gov_calendar_user_session", JSON.stringify(session));
    showToast(`ยินดีต้อนรับคุณ ${session.name} เข้าสู่ระบบสำเร็จ`, "success");
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("gov_calendar_user_session");
    showToast("ออกจากระบบเรียบร้อยแล้ว", "info");
  };

  // 1. Initial Load and Sync logic
  const loadData = useCallback(async (config: SupabaseConfig | null) => {
    setIsDbLoading(true);
    setDbError(null);

    if (config) {
      try {
        const client = createDynamicSupabaseClient(config);
        const { data, error } = await client
          .from(config.tableName || "events")
          .select("*");

        if (error) {
          throw error;
        }

        if (data) {
          // Normalize dates / structure
          const formattedEvents: EventData[] = data.map((evt: any) => ({
            id: evt.id,
            title: evt.title,
            description: evt.description || "",
            date: evt.date,
            end_date: evt.end_date,
            start_time: evt.start_time,
            end_time: evt.end_time,
            group_id: evt.group_id,
            location: evt.location || "",
            is_online: evt.is_online === true || evt.is_online === "true",
            online_platform: evt.online_platform || "",
            is_holiday: evt.is_holiday === true || evt.is_holiday === "true",
            created_by: evt.created_by || "ผู้ลงบันทึก",
            created_at: evt.created_at,
          }));

          setEvents(formattedEvents);
          showToast("เชื่อมโยงข้อมูลจากฐานข้อมูล Supabase สำเร็จ", "success");
        }
      } catch (e: any) {
        console.error("Failed to load from Supabase:", e);
        setDbError(e.message || "ไม่สามารถเชื่อมต่อตารางข้อมูลใน Supabase ได้");
        showToast("ไม่สามารถดึงข้อมูลจาก Supabase ได้, กำลังสลับใช้งานฐานข้อมูลในเครื่องชั่วคราว", "error");
        
        // Fallback to local storage
        loadFromLocalStorage();
      } finally {
        setIsDbLoading(false);
      }
    } else {
      // Offline/Local mode
      loadFromLocalStorage();
      setIsDbLoading(false);
    }
  }, [showToast]);

  const loadFromLocalStorage = () => {
    try {
      const saved = localStorage.getItem("gov_calendar_local_events");
      if (saved) {
        setEvents(JSON.parse(saved));
      } else {
        // First-time seeding with our MOCK_EVENTS
        localStorage.setItem("gov_calendar_local_events", JSON.stringify(MOCK_EVENTS));
        setEvents(MOCK_EVENTS);
      }
    } catch (e) {
      console.error("Failed to load local storage", e);
      setEvents(MOCK_EVENTS);
    }
  };

  useEffect(() => {
    loadData(supabaseConfig);
  }, [supabaseConfig, loadData]);

  // Save / Update Event handler
  const handleSaveEvent = async (formData: Omit<EventData, "id" | "created_at"> & { id?: string }) => {
    const isEditing = !!formData.id;

    if (supabaseConfig) {
      // Supabase Save Flow
      try {
        setIsDbLoading(true);
        const client = createDynamicSupabaseClient(supabaseConfig);
        const tableName = supabaseConfig.tableName || "events";

        const payload: any = {
          title: formData.title,
          description: formData.description,
          date: formData.date,
          end_date: formData.end_date,
          start_time: formData.start_time,
          end_time: formData.end_time,
          group_id: formData.group_id,
          location: formData.location,
          is_online: formData.is_online,
          online_platform: formData.online_platform || "",
          is_holiday: formData.is_holiday,
          created_by: formData.created_by,
        };

        if (isEditing) {
          // Update
          let { error } = await client
            .from(tableName)
            .update(payload)
            .eq("id", formData.id);

          if (error) {
            // Fallback if the column doesn't exist on an older table structure in Supabase
            if (error.code === "42703" || error.message?.includes("online_platform") || error.message?.includes("end_date")) {
              const { online_platform, end_date, ...fallbackPayload } = payload;
              const retry = await client
                .from(tableName)
                .update(fallbackPayload)
                .eq("id", formData.id);
              if (retry.error) throw retry.error;
            } else {
              throw error;
            }
          }
          showToast("แก้ไขกิจกรรมการประชุมสำเร็จใน Supabase", "success");
        } else {
          // Insert
          let { error } = await client
            .from(tableName)
            .insert([payload]);

          if (error) {
            // Fallback if the column doesn't exist on an older table structure in Supabase
            if (error.code === "42703" || error.message?.includes("online_platform") || error.message?.includes("end_date")) {
              const { online_platform, end_date, ...fallbackPayload } = payload;
              const retry = await client
                .from(tableName)
                .insert([fallbackPayload]);
              if (retry.error) throw retry.error;
            } else {
              throw error;
            }
          }
          showToast("เพิ่มกิจกรรมการประชุมสำเร็จใน Supabase", "success");
        }
        
        // Reload all data
        await loadData(supabaseConfig);
      } catch (e: any) {
        console.error("Supabase Save Error", e);
        showToast(`บันทึกข้อมูลล้มเหลว: ${e.message || "เกิดข้อผิดพลาด"}`, "error");
      } finally {
        setIsDbLoading(false);
      }
    } else {
      // Local Database Save Flow
      try {
        let updatedList: EventData[] = [];
        if (isEditing) {
          updatedList = events.map((item) => {
            if (item.id === formData.id) {
              return {
                ...item,
                title: formData.title,
                description: formData.description,
                date: formData.date,
                end_date: formData.end_date,
                start_time: formData.start_time,
                end_time: formData.end_time,
                group_id: formData.group_id,
                location: formData.location,
                is_online: formData.is_online,
                online_platform: formData.online_platform || "",
                is_holiday: formData.is_holiday,
                created_by: formData.created_by,
              };
            }
            return item;
          });
          showToast("แก้ไขกิจกรรมการประชุมเรียบร้อยแล้ว", "success");
        } else {
          const newEvent: EventData = {
            id: "evt-" + Date.now(),
            title: formData.title,
            description: formData.description,
            date: formData.date,
            end_date: formData.end_date,
            start_time: formData.start_time,
            end_time: formData.end_time,
            group_id: formData.group_id,
            location: formData.location,
            is_online: formData.is_online,
            online_platform: formData.online_platform || "",
            is_holiday: formData.is_holiday,
            created_by: formData.created_by,
            created_at: new Date().toISOString(),
          };
          updatedList = [...events, newEvent];
          showToast("เพิ่มกิจกรรมการประชุมเรียบร้อยแล้ว", "success");
        }

        setEvents(updatedList);
        localStorage.setItem("gov_calendar_local_events", JSON.stringify(updatedList));
      } catch (e) {
        console.error("Local Save Error", e);
        showToast("เกิดข้อผิดพลาดในการบันทึกข้อมูล", "error");
      }
    }
  };

  // Delete Event handler - triggers modal
  const handleDeleteEvent = (id: string) => {
    setConfirmDeleteId(id);
  };

  // Actual execution of delete
  const executeDelete = async () => {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);

    if (supabaseConfig) {
      // Supabase Delete Flow
      try {
        setIsDbLoading(true);
        const client = createDynamicSupabaseClient(supabaseConfig);
        const { error } = await client
          .from(supabaseConfig.tableName || "events")
          .delete()
          .eq("id", id);

        if (error) throw error;
        showToast("ลบกิจกรรมการประชุมสำเร็จใน Supabase", "success");
        await loadData(supabaseConfig);
      } catch (e: any) {
        console.error("Supabase Delete Error", e);
        showToast(`ลบข้อมูลล้มเหลว: ${e.message || "เกิดข้อผิดพลาด"}`, "error");
      } finally {
        setIsDbLoading(false);
      }
    } else {
      // Local Storage Delete Flow
      const updatedList = events.filter((e) => e.id !== id);
      setEvents(updatedList);
      localStorage.setItem("gov_calendar_local_events", JSON.stringify(updatedList));
      showToast("ลบกิจกรรมการประชุมเรียบร้อยแล้ว", "success");
    }
  };

  // Callback from Database configuration Modal
  const handleSaveSupabaseConfig = (newConfig: SupabaseConfig | null) => {
    saveSupabaseConfig(newConfig);
    setSupabaseConfigState(newConfig);
    if (newConfig) {
      showToast("บันทึกการเชื่อมตั้งค่า Supabase เรียบร้อย", "success");
    } else {
      showToast("ยกเลิกการเชื่อมต่อสำเร็จ กำลังใช้งานโหมดออฟไลน์", "info");
    }
  };

  // Search filter matching
  const filteredEvents = events.filter((evt) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      evt.title.toLowerCase().includes(term) ||
      (evt.description || "").toLowerCase().includes(term) ||
      (evt.location || "").toLowerCase().includes(term) ||
      (evt.created_by || "").toLowerCase().includes(term)
    );
  });

  const handleToggleGroupFilter = (groupId: string) => {
    setActiveGroupFilters((prev) => {
      if (prev.includes(groupId)) {
        return prev.filter((id) => id !== groupId);
      } else {
        return [...prev, groupId];
      }
    });
  };

  const handleAddGroup = (newGroup: Group) => {
    const newGroups = [...groups, newGroup];
    setGroups(newGroups);
    localStorage.setItem("gov_calendar_groups", JSON.stringify(newGroups));
    showToast("เพิ่มกลุ่มงานใหม่เรียบร้อย", "success");
  };

  const handleUpdateGroup = (updatedGroup: Group) => {
    const newGroups = groups.map(g => g.id === updatedGroup.id ? updatedGroup : g);
    setGroups(newGroups);
    localStorage.setItem("gov_calendar_groups", JSON.stringify(newGroups));
    showToast("แก้ไขกลุ่มงานเรียบร้อย", "success");
  };

  const handleDeleteGroup = (groupId: string) => {
    const newGroups = groups.filter(g => g.id !== groupId);
    setGroups(newGroups);
    localStorage.setItem("gov_calendar_groups", JSON.stringify(newGroups));
    showToast("ลบกลุ่มงานเรียบร้อย", "success");
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans antialiased text-slate-800 pb-12">
      
      {/* 1. Global Header */}
      <Header
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        supabaseConfig={supabaseConfig}
        onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
        onOpenAddEventModal={() => {
          setEditingEvent(null);
          setIsEventModalOpen(true);
        }}
        onOpenGroupManagerModal={() => setIsGroupManagerModalOpen(true)}
        totalEvents={events.length}
        user={user}
        onOpenLoginModal={() => setIsLoginModalOpen(true)}
        onLogout={handleLogout}
      />

      {/* 2. Main Container Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        
        {/* Loading Overlay/Spinner for DB operations */}
        {isDbLoading && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6 flex items-center justify-between gap-3 shadow-sm animate-pulse">
            <div className="flex items-center gap-3">
              <RefreshCw className="w-5 h-5 text-emerald-600 animate-spin" />
              <div>
                <p className="text-sm font-bold text-emerald-800 font-sans">กำลังทำรายการกับฐานข้อมูล...</p>
                <p className="text-xs text-emerald-600 font-sans">เชื่อมต่อข้อมูลแบบเรียลไทม์กับเซิร์ฟเวอร์สำนักงาน</p>
              </div>
            </div>
          </div>
        )}

        {/* Database Error Banner */}
        {dbError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3 shadow-sm">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-bold text-red-800 font-sans">ข้อขัดข้องการเชื่อมโยง Supabase</p>
              <p className="text-xs text-red-600/90 font-sans mt-0.5">{dbError}</p>
              <button
                id="retry-connection-banner-btn"
                onClick={() => loadData(supabaseConfig)}
                className="text-xs underline text-red-700 hover:text-red-900 font-bold mt-2 block"
              >
                ลองเชื่อมต่อใหม่อีกครั้ง
              </button>
            </div>
          </div>
        )}

        {/* Informative Welcome Banner if Local DB is used */}
        {!supabaseConfig && (
          <div className="bg-amber-50/70 border border-amber-200/60 rounded-xl p-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <Database className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-amber-800 font-sans">ขณะนี้แอปพลิเคชันจัดเก็บข้อมูลภายในเครื่องของคุณ (Local Database)</p>
                <p className="text-xs text-amber-600 font-sans mt-0.5">กิจกรรมทั้งหมดที่คุณสร้างจะบันทึกไว้ในเบราว์เซอร์นี้ หากต้องการบันทึกขึ้นคลาวด์ออนไลน์ กรุณาคลิกที่ตั้งค่าฐานข้อมูล</p>
              </div>
            </div>
            <button
              id="connect-supabase-banner-btn"
              onClick={() => setIsSupabaseModalOpen(true)}
              className="text-xs font-semibold px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow transition-colors font-sans whitespace-nowrap"
            >
              เชื่อมต่อ Supabase จริง
            </button>
          </div>
        )}

        {/* Active Search Filter Status */}
        {searchTerm && (
          <div className="bg-slate-100 border border-slate-200 rounded-xl p-3.5 mb-6 flex items-center justify-between">
            <div className="text-xs text-slate-600 font-sans">
              กำลังค้นหาด้วยคำว่า: <strong className="text-slate-900 font-bold">"{searchTerm}"</strong> — พบผลลัพธ์การประชุมทั้งหมด <strong className="text-red-600 text-sm font-bold">{filteredEvents.length}</strong> รายการ
            </div>
            <button
              id="clear-search-btn"
              onClick={() => setSearchTerm("")}
              className="text-xs font-semibold text-red-600 hover:text-red-800 font-sans"
            >
              ล้างการค้นหา
            </button>
          </div>
        )}

        {/* Page Switcher Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/60 shadow-inner max-w-sm mb-6">
          <button
            id="tab-calendar-btn"
            type="button"
            onClick={() => setActiveTab("calendar")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer ${
              activeTab === "calendar"
                ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                : "text-slate-500 hover:text-slate-800 border border-transparent"
            }`}
          >
            <Calendar className="w-4 h-4 text-red-600" />
            <span>ปฏิทินงานประชุม</span>
          </button>
          <button
            id="tab-analytics-btn"
            type="button"
            onClick={() => setActiveTab("analytics")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer ${
              activeTab === "analytics"
                ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                : "text-slate-500 hover:text-slate-800 border border-transparent"
            }`}
          >
            <BarChart3 className="w-4 h-4 text-slate-600" />
            <span>วิเคราะห์และสถิติ</span>
          </button>
        </div>

        {/* Conditional Rendering of Views */}
        {activeTab === "analytics" ? (
          <MeetingStatsDashboard events={events} groups={groups} />
        ) : (
          <CalendarView
            events={filteredEvents}
            groups={groups}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onEditEvent={(evt) => {
              setEditingEvent(evt);
              setIsEventModalOpen(true);
            }}
            onDeleteEvent={handleDeleteEvent}
            activeGroupFilters={activeGroupFilters}
            onToggleGroupFilter={handleToggleGroupFilter}
            onClearFilters={() => setActiveGroupFilters([])}
            isLoggedIn={!!user}
          />
        )}

      </main>

      {/* Group Manager Modal */}
      <GroupManagerModal
        isOpen={isGroupManagerModalOpen}
        onClose={() => setIsGroupManagerModalOpen(false)}
        groups={groups}
        onAddGroup={handleAddGroup}
        onUpdateGroup={handleUpdateGroup}
        onDeleteGroup={handleDeleteGroup}
      />

      {/* 3. Event Form Modal */}
      <EventFormModal
        isOpen={isEventModalOpen}
        onClose={() => {
          setIsEventModalOpen(false);
          setEditingEvent(null);
        }}
        groups={groups}
        selectedDate={selectedDate}
        editingEvent={editingEvent}
        onSave={handleSaveEvent}
      />

      {/* 4. Supabase Setup Modal */}
      <SupabaseConfigModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
        currentConfig={supabaseConfig}
        onSaveConfig={handleSaveSupabaseConfig}
      />

      {/* 5. Access Authentication Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2 font-sans">
                ยืนยันการลบ
              </h3>
              <p className="text-slate-500 text-sm font-sans mb-6">
                คุณต้องการลบกิจกรรมการประชุมนี้ใช่หรือไม่? การลบไม่สามารถเรียกคืนข้อมูลได้
              </p>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={executeDelete}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-xl transition-colors shadow-sm"
                >
                  ใช่, ลบเลย
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(null)}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl transition-colors"
                >
                  ยกเลิก
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. Elegant Toasts Notification Portal */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`p-4 rounded-xl shadow-lg border text-white text-xs font-sans font-medium flex items-center justify-between gap-3 pointer-events-auto transform transition-all translate-y-0 opacity-100 animate-slide-in ${
              toast.type === "success" 
                ? "bg-slate-900 border-slate-800" 
                : toast.type === "error" 
                  ? "bg-red-600 border-red-500" 
                  : "bg-indigo-600 border-indigo-500"
            }`}
          >
            <span>{toast.message}</span>
            <button 
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="text-white/60 hover:text-white font-bold"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

    </div>
  );
}
