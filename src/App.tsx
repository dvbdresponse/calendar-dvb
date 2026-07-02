import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, BarChart3, Calendar, Database, RefreshCw } from "lucide-react";
import { EventData, Group, SupabaseConfig, UserSession } from "./types";
import { MOCK_EVENTS, GROUPS as INITIAL_GROUPS } from "./data/constants";
import {
  createDynamicSupabaseClient,
  getCurrentSession,
  getSupabaseConfig,
  getUserProfile,
  hasValidSupabaseConfig,
  saveSupabaseConfig,
  signInWithPassword,
  signOut,
} from "./utils/supabaseClient";

import Header from "./components/Header";
import CalendarView from "./components/CalendarView";
import EventFormModal from "./components/EventFormModal";
import SupabaseConfigModal from "./components/SupabaseConfigModal";
import LoginModal from "./components/LoginModal";
import GroupManagerModal from "./components/GroupManagerModal";

const MeetingStatsDashboard = lazy(() => import("./components/MeetingStatsDashboard"));

const EVENTS_STORAGE_KEY = "gov_calendar_local_events";
const GROUPS_STORAGE_KEY = "gov_calendar_groups";
const LEGACY_SESSION_KEY = "gov_calendar_user_session";

const normalizeEvent = (evt: any): EventData => ({
  id: evt.id,
  title: evt.title,
  description: evt.description || "",
  date: evt.date,
  end_date: evt.end_date || undefined,
  start_time: evt.start_time || "",
  end_time: evt.end_time || "",
  group_id: evt.group_id,
  location: evt.location || "",
  is_online: evt.is_online === true || evt.is_online === "true",
  online_platform: evt.online_platform || "",
  is_holiday: evt.is_holiday === true || evt.is_holiday === "true",
  created_by: evt.created_by || "ผู้ลงบันทึก",
  created_by_user_id: evt.created_by_user_id || undefined,
  created_at: evt.created_at,
  updated_at: evt.updated_at || undefined,
});

const normalizeGroup = (group: any): Group => ({
  id: group.id,
  name: group.name,
  label: group.label,
  color: group.color || "#cbd5e1",
  bgColor: group.bg_color || group.bgColor || "bg-slate-50",
  textColor: group.text_color || group.textColor || "text-slate-700",
  borderColor: group.border_color || group.borderColor || "border-slate-200",
  created_at: group.created_at,
  updated_at: group.updated_at,
});

const groupToPayload = (group: Group) => ({
  id: group.id,
  name: group.name,
  label: group.label,
  color: group.color,
  bg_color: group.bgColor,
  text_color: group.textColor,
  border_color: group.borderColor,
});

export default function App() {
  const [events, setEvents] = useState<EventData[]>([]);
  const [groups, setGroups] = useState<Group[]>(() => {
    const savedGroups = localStorage.getItem(GROUPS_STORAGE_KEY);
    return savedGroups ? JSON.parse(savedGroups) : INITIAL_GROUPS;
  });
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [user, setUser] = useState<UserSession | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"calendar" | "analytics">("calendar");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeGroupFilters, setActiveGroupFilters] = useState<string[]>([]);
  const [supabaseConfig, setSupabaseConfigState] = useState<SupabaseConfig | null>(getSupabaseConfig());
  const [isDbLoading, setIsDbLoading] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isGroupManagerModalOpen, setIsGroupManagerModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventData | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<{ id: string; message: string; type: "success" | "error" | "info" }[]>([]);

  const isSupabaseMode = hasValidSupabaseConfig(supabaseConfig);
  const canCreateEvent = isSupabaseMode && !!user;
  const canManageGroups = isSupabaseMode && user?.role === "admin";

  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "success") => {
    const id = Math.random().toString(36).slice(2, 11);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const loadFromLocalStorage = useCallback(() => {
    try {
      const saved = localStorage.getItem(EVENTS_STORAGE_KEY);
      if (saved) {
        setEvents(JSON.parse(saved));
      } else {
        localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(MOCK_EVENTS));
        setEvents(MOCK_EVENTS);
      }

      const savedGroups = localStorage.getItem(GROUPS_STORAGE_KEY);
      setGroups(savedGroups ? JSON.parse(savedGroups) : INITIAL_GROUPS);
    } catch (e) {
      console.error("Failed to load local storage", e);
      setEvents(MOCK_EVENTS);
      setGroups(INITIAL_GROUPS);
    }
  }, []);

  const loadData = useCallback(async (config: SupabaseConfig | null, options?: { quiet?: boolean }) => {
    setIsDbLoading(true);
    setDbError(null);

    if (hasValidSupabaseConfig(config)) {
      try {
        const client = createDynamicSupabaseClient(config);
        const tableName = config.tableName || "events";

        const [eventsResult, groupsResult] = await Promise.all([
          client.from(tableName).select("*").order("date", { ascending: true }).order("start_time", { ascending: true }),
          client.from("groups").select("*").order("name", { ascending: true }),
        ]);

        if (eventsResult.error) throw eventsResult.error;
        if (groupsResult.error) throw groupsResult.error;

        setEvents((eventsResult.data || []).map(normalizeEvent));
        setGroups((groupsResult.data && groupsResult.data.length > 0 ? groupsResult.data : INITIAL_GROUPS).map(normalizeGroup));

        if (!options?.quiet) {
          showToast("เชื่อมโยงข้อมูลจาก Supabase สำเร็จ", "success");
        }
      } catch (e: any) {
        console.error("Failed to load from Supabase:", e);
        setEvents([]);
        setDbError(e.message || "ไม่สามารถเชื่อมต่อ Supabase ได้");
        showToast("ไม่สามารถดึงข้อมูลจาก Supabase ได้ ระบบจะไม่สลับไปบันทึก local อัตโนมัติ", "error");
      } finally {
        setIsDbLoading(false);
      }
    } else {
      loadFromLocalStorage();
      setIsDbLoading(false);
    }
  }, [loadFromLocalStorage, showToast]);

  const refreshProfile = useCallback(async (config: SupabaseConfig | null) => {
    if (!hasValidSupabaseConfig(config)) {
      setUser(null);
      return;
    }

    try {
      setIsAuthLoading(true);
      const client = createDynamicSupabaseClient(config);
      const session = await getCurrentSession(client);
      const profile = await getUserProfile(client, session);
      setUser(profile);
      localStorage.removeItem(LEGACY_SESSION_KEY);
    } catch (e: any) {
      console.error("Failed to load Supabase auth profile", e);
      setUser(null);
      showToast(`โหลดข้อมูลผู้ใช้ไม่สำเร็จ: ${e.message || "เกิดข้อผิดพลาด"}`, "error");
    } finally {
      setIsAuthLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData(supabaseConfig, { quiet: true });
    refreshProfile(supabaseConfig);
  }, [loadData, refreshProfile, supabaseConfig]);

  useEffect(() => {
    if (!hasValidSupabaseConfig(supabaseConfig)) return;

    const client = createDynamicSupabaseClient(supabaseConfig);
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      getUserProfile(client, session)
        .then(setUser)
        .catch((e) => {
          console.error("Auth state profile load failed", e);
          setUser(null);
        });
    });

    return () => data.subscription.unsubscribe();
  }, [supabaseConfig]);

  const ensureCanWriteEvent = (event?: EventData | null) => {
    if (!isSupabaseMode) {
      showToast("ต้องเชื่อมต่อ Supabase และเข้าสู่ระบบก่อนจึงจะแก้ไขข้อมูลได้", "error");
      setIsSupabaseModalOpen(true);
      return false;
    }
    if (!user) {
      showToast("กรุณาเข้าสู่ระบบด้วยบัญชี Supabase ก่อนแก้ไขข้อมูล", "error");
      setIsLoginModalOpen(true);
      return false;
    }
    if (event && user.role !== "admin" && event.created_by_user_id !== user.id) {
      showToast("บัญชีนี้แก้ไขหรือลบได้เฉพาะรายการที่ตนเองสร้าง", "error");
      return false;
    }
    return true;
  };

  const canManageEvent = useCallback((event: EventData) => {
    return !!user && (user.role === "admin" || event.created_by_user_id === user.id);
  }, [user]);

  const validateEventPayload = (formData: Omit<EventData, "id" | "created_at"> & { id?: string }) => {
    if (!formData.title.trim()) return "กรุณากรอกหัวข้อกิจกรรมการประชุม";
    if (!formData.date) return "กรุณาระบุวันที่จัดกิจกรรม";
    if (formData.end_date && formData.end_date < formData.date) return "วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น";
    if (!groups.some((g) => g.id === formData.group_id)) return "กรุณาเลือกกลุ่มงานที่มีอยู่จริง";
    if (!formData.created_by.trim()) return "กรุณาระบุชื่อผู้ลงบันทึก";
    const isMultiDay = formData.end_date && formData.end_date !== formData.date;
    if (!isMultiDay && (!formData.start_time || !formData.end_time || formData.start_time > formData.end_time)) {
      return "กรุณาตรวจสอบเวลาเริ่มต้นและเวลาสิ้นสุด";
    }
    return null;
  };

  const handleLogin = async (email: string, password: string) => {
    if (!hasValidSupabaseConfig(supabaseConfig)) {
      throw new Error("กรุณาตั้งค่า Supabase ก่อนเข้าสู่ระบบ");
    }

    const client = createDynamicSupabaseClient(supabaseConfig);
    const session = await signInWithPassword(client, email, password);
    const profile = await getUserProfile(client, session);
    setUser(profile);
    showToast(`ยินดีต้อนรับคุณ ${profile?.name || email}`, "success");
  };

  const handleLogout = async () => {
    if (!hasValidSupabaseConfig(supabaseConfig)) {
      setUser(null);
      return;
    }

    try {
      await signOut(createDynamicSupabaseClient(supabaseConfig));
      setUser(null);
      showToast("ออกจากระบบเรียบร้อยแล้ว", "info");
    } catch (e: any) {
      showToast(`ออกจากระบบไม่สำเร็จ: ${e.message || "เกิดข้อผิดพลาด"}`, "error");
    }
  };

  const handleSaveEvent = async (formData: Omit<EventData, "id" | "created_at"> & { id?: string }) => {
    const validationError = validateEventPayload(formData);
    if (validationError) {
      showToast(validationError, "error");
      return;
    }

    const currentEvent = formData.id ? events.find((item) => item.id === formData.id) : null;
    if (!ensureCanWriteEvent(currentEvent)) return;

    if (hasValidSupabaseConfig(supabaseConfig)) {
      try {
        setIsDbLoading(true);
        const client = createDynamicSupabaseClient(supabaseConfig);
        const tableName = supabaseConfig.tableName || "events";
        const payload = {
          title: formData.title,
          description: formData.description,
          date: formData.date,
          end_date: formData.end_date || null,
          start_time: formData.start_time,
          end_time: formData.end_time,
          group_id: formData.group_id,
          location: formData.location,
          is_online: formData.is_online,
          online_platform: formData.online_platform || "",
          is_holiday: formData.is_holiday,
          created_by: formData.created_by,
          created_by_user_id: currentEvent?.created_by_user_id || user?.id,
        };

        const { error } = formData.id
          ? await client.from(tableName).update(payload).eq("id", formData.id)
          : await client.from(tableName).insert([payload]);

        if (error) throw error;

        showToast(formData.id ? "แก้ไขกิจกรรมใน Supabase สำเร็จ" : "เพิ่มกิจกรรมใน Supabase สำเร็จ", "success");
        await loadData(supabaseConfig, { quiet: true });
      } catch (e: any) {
        console.error("Supabase Save Error", e);
        showToast(`บันทึกข้อมูลล้มเหลว: ${e.message || "เกิดข้อผิดพลาด"}`, "error");
      } finally {
        setIsDbLoading(false);
      }
      return;
    }

    try {
      const updatedList = formData.id
        ? events.map((item) => item.id === formData.id ? { ...item, ...formData } as EventData : item)
        : [
            ...events,
            {
              ...formData,
              id: `evt-${Date.now()}`,
              created_at: new Date().toISOString(),
            } as EventData,
          ];

      setEvents(updatedList);
      localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(updatedList));
      showToast(formData.id ? "แก้ไขกิจกรรมในเครื่องเรียบร้อยแล้ว" : "เพิ่มกิจกรรมในเครื่องเรียบร้อยแล้ว", "success");
    } catch (e) {
      console.error("Local Save Error", e);
      showToast("เกิดข้อผิดพลาดในการบันทึกข้อมูล", "error");
    }
  };

  const handleDeleteEvent = (id: string) => {
    const currentEvent = events.find((event) => event.id === id);
    if (!ensureCanWriteEvent(currentEvent)) return;
    setConfirmDeleteId(id);
  };

  const executeDelete = async () => {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    const currentEvent = events.find((event) => event.id === id);
    setConfirmDeleteId(null);
    if (!ensureCanWriteEvent(currentEvent)) return;

    if (hasValidSupabaseConfig(supabaseConfig)) {
      try {
        setIsDbLoading(true);
        const client = createDynamicSupabaseClient(supabaseConfig);
        const { error } = await client.from(supabaseConfig.tableName || "events").delete().eq("id", id);
        if (error) throw error;
        showToast("ลบกิจกรรมใน Supabase สำเร็จ", "success");
        await loadData(supabaseConfig, { quiet: true });
      } catch (e: any) {
        console.error("Supabase Delete Error", e);
        showToast(`ลบข้อมูลล้มเหลว: ${e.message || "เกิดข้อผิดพลาด"}`, "error");
      } finally {
        setIsDbLoading(false);
      }
      return;
    }

    const updatedList = events.filter((e) => e.id !== id);
    setEvents(updatedList);
    localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(updatedList));
    showToast("ลบกิจกรรมในเครื่องเรียบร้อยแล้ว", "success");
  };

  const handleSaveSupabaseConfig = (newConfig: SupabaseConfig | null) => {
    saveSupabaseConfig(newConfig);
    setSupabaseConfigState(newConfig);
    setUser(null);
    if (newConfig) {
      showToast("บันทึกการตั้งค่า Supabase เรียบร้อย กรุณาเข้าสู่ระบบเพื่อแก้ไขข้อมูล", "success");
    } else {
      showToast("ยกเลิกการเชื่อมต่อสำเร็จ กำลังใช้งานโหมดข้อมูลในเครื่อง", "info");
    }
  };

  const handleAddGroup = async (newGroup: Group) => {
    if (!canManageGroups) {
      showToast("ต้องเข้าสู่ระบบผ่าน Supabase Auth ด้วยสิทธิ์ admin เพื่อจัดการกลุ่มงาน", "error");
      return;
    }

    if (hasValidSupabaseConfig(supabaseConfig)) {
      try {
        const client = createDynamicSupabaseClient(supabaseConfig);
        const { error } = await client.from("groups").insert([groupToPayload(newGroup)]);
        if (error) throw error;
        showToast("เพิ่มกลุ่มงานใน Supabase เรียบร้อย", "success");
        await loadData(supabaseConfig, { quiet: true });
      } catch (e: any) {
        showToast(`เพิ่มกลุ่มงานล้มเหลว: ${e.message || "เกิดข้อผิดพลาด"}`, "error");
      }
      return;
    }

    const newGroups = [...groups, newGroup];
    setGroups(newGroups);
    localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(newGroups));
    showToast("เพิ่มกลุ่มงานในเครื่องเรียบร้อย", "success");
  };

  const handleUpdateGroup = async (updatedGroup: Group) => {
    if (!canManageGroups) {
      showToast("ต้องเข้าสู่ระบบผ่าน Supabase Auth ด้วยสิทธิ์ admin เพื่อจัดการกลุ่มงาน", "error");
      return;
    }

    if (hasValidSupabaseConfig(supabaseConfig)) {
      try {
        const client = createDynamicSupabaseClient(supabaseConfig);
        const { error } = await client.from("groups").update(groupToPayload(updatedGroup)).eq("id", updatedGroup.id);
        if (error) throw error;
        showToast("แก้ไขกลุ่มงานใน Supabase เรียบร้อย", "success");
        await loadData(supabaseConfig, { quiet: true });
      } catch (e: any) {
        showToast(`แก้ไขกลุ่มงานล้มเหลว: ${e.message || "เกิดข้อผิดพลาด"}`, "error");
      }
      return;
    }

    const newGroups = groups.map((g) => g.id === updatedGroup.id ? updatedGroup : g);
    setGroups(newGroups);
    localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(newGroups));
    showToast("แก้ไขกลุ่มงานในเครื่องเรียบร้อย", "success");
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!canManageGroups) {
      showToast("ต้องเข้าสู่ระบบผ่าน Supabase Auth ด้วยสิทธิ์ admin เพื่อจัดการกลุ่มงาน", "error");
      return;
    }
    if (events.some((event) => event.group_id === groupId)) {
      showToast("ไม่สามารถลบกลุ่มงานที่ยังมีรายการประชุมผูกอยู่", "error");
      return;
    }

    if (hasValidSupabaseConfig(supabaseConfig)) {
      try {
        const client = createDynamicSupabaseClient(supabaseConfig);
        const { error } = await client.from("groups").delete().eq("id", groupId);
        if (error) throw error;
        showToast("ลบกลุ่มงานใน Supabase เรียบร้อย", "success");
        await loadData(supabaseConfig, { quiet: true });
      } catch (e: any) {
        showToast(`ลบกลุ่มงานล้มเหลว: ${e.message || "เกิดข้อผิดพลาด"}`, "error");
      }
      return;
    }

    const newGroups = groups.filter((g) => g.id !== groupId);
    setGroups(newGroups);
    localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(newGroups));
    showToast("ลบกลุ่มงานในเครื่องเรียบร้อย", "success");
  };

  const filteredEvents = useMemo(() => {
    if (!searchTerm.trim()) return events;
    const term = searchTerm.toLowerCase();
    return events.filter((evt) => (
      evt.title.toLowerCase().includes(term) ||
      (evt.description || "").toLowerCase().includes(term) ||
      (evt.location || "").toLowerCase().includes(term) ||
      (evt.created_by || "").toLowerCase().includes(term)
    ));
  }, [events, searchTerm]);

  const handleToggleGroupFilter = (groupId: string) => {
    setActiveGroupFilters((prev) => (
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    ));
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans antialiased text-slate-800 pb-12">
      <Header
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        supabaseConfig={supabaseConfig}
        onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
        onOpenAddEventModal={() => {
          if (!canCreateEvent) {
            if (!isSupabaseMode) {
              showToast("ต้องเชื่อมต่อ Supabase ก่อนเพิ่มกิจกรรม", "error");
              setIsSupabaseModalOpen(true);
            } else {
              showToast("กรุณาเข้าสู่ระบบก่อนเพิ่มกิจกรรม", "error");
              setIsLoginModalOpen(true);
            }
            return;
          }
          setEditingEvent(null);
          setIsEventModalOpen(true);
        }}
        onOpenGroupManagerModal={() => {
          if (!canManageGroups) {
            if (!isSupabaseMode) {
              showToast("ต้องเชื่อมต่อ Supabase ก่อนจัดการกลุ่มงาน", "error");
              setIsSupabaseModalOpen(true);
            } else {
              showToast("ต้องเข้าสู่ระบบผ่าน Supabase Auth ด้วยสิทธิ์ admin เพื่อจัดการกลุ่มงาน", "error");
              if (!user) setIsLoginModalOpen(true);
            }
            return;
          }
          setIsGroupManagerModalOpen(true);
        }}
        totalEvents={events.length}
        user={user}
        isAuthLoading={isAuthLoading}
        canCreateEvent={canCreateEvent}
        canManageGroups={canManageGroups}
        onOpenLoginModal={() => setIsLoginModalOpen(true)}
        onLogout={handleLogout}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {isDbLoading && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6 flex items-center justify-between gap-3 shadow-sm animate-pulse">
            <div className="flex items-center gap-3">
              <RefreshCw className="w-5 h-5 text-emerald-600 animate-spin" />
              <div>
                <p className="text-sm font-bold text-emerald-800 font-sans">กำลังทำรายการกับฐานข้อมูล...</p>
                <p className="text-xs text-emerald-600 font-sans">
                  {isSupabaseMode ? "เชื่อมต่อข้อมูลกับ Supabase" : "กำลังอ่านข้อมูลภายในเครื่อง"}
                </p>
              </div>
            </div>
          </div>
        )}

        {dbError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3 shadow-sm">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-bold text-red-800 font-sans">ข้อขัดข้องการเชื่อมโยง Supabase</p>
              <p className="text-xs text-red-600/90 font-sans mt-0.5">{dbError}</p>
              <p className="text-xs text-red-600/80 font-sans mt-1">ไม่มีการ fallback ไปเขียน local อัตโนมัติ เพื่อป้องกันข้อมูลแยกคนละแหล่งโดยไม่ตั้งใจ</p>
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

        {!isSupabaseMode && (
          <div className="bg-amber-50/70 border border-amber-200/60 rounded-xl p-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <Database className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-amber-800 font-sans">โหมดข้อมูลในเครื่อง (Local Demo)</p>
                <p className="text-xs text-amber-600 font-sans mt-0.5">โหมดนี้ใช้ดูข้อมูลตัวอย่างเท่านั้น การเพิ่ม แก้ไข หรือลบข้อมูลต้องเชื่อมต่อ Supabase และเข้าสู่ระบบผ่าน Supabase Auth</p>
              </div>
            </div>
            <button
              id="connect-supabase-banner-btn"
              onClick={() => setIsSupabaseModalOpen(true)}
              className="text-xs font-semibold px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow transition-colors font-sans whitespace-nowrap"
            >
              ตั้งค่า Supabase
            </button>
          </div>
        )}

        {isSupabaseMode && !user && (
          <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-sky-800 font-sans">อ่านปฏิทินได้แบบสาธารณะ</p>
              <p className="text-xs text-sky-600 font-sans mt-0.5">การเพิ่ม แก้ไข หรือลบข้อมูลต้องเข้าสู่ระบบด้วยบัญชี Supabase ที่มี profile แล้ว</p>
            </div>
            <button
              type="button"
              onClick={() => setIsLoginModalOpen(true)}
              className="text-xs font-semibold px-3.5 py-1.5 bg-sky-700 hover:bg-sky-800 text-white rounded-lg shadow transition-colors font-sans whitespace-nowrap"
            >
              เข้าสู่ระบบ
            </button>
          </div>
        )}

        {searchTerm && (
          <div className="bg-slate-100 border border-slate-200 rounded-xl p-3.5 mb-6 flex items-center justify-between">
            <div className="text-xs text-slate-600 font-sans">
              กำลังค้นหาด้วยคำว่า: <strong className="text-slate-900 font-bold">"{searchTerm}"</strong> พบผลลัพธ์ <strong className="text-red-600 text-sm font-bold">{filteredEvents.length}</strong> รายการ
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

        {activeTab === "analytics" ? (
          <Suspense fallback={<div className="bg-white border border-slate-100 rounded-xl p-6 text-sm text-slate-500">กำลังโหลดรายงานสถิติ...</div>}>
            <MeetingStatsDashboard events={events} groups={groups} />
          </Suspense>
        ) : (
          <CalendarView
            events={filteredEvents}
            groups={groups}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onEditEvent={(evt) => {
              if (!ensureCanWriteEvent(evt)) return;
              setEditingEvent(evt);
              setIsEventModalOpen(true);
            }}
            onDeleteEvent={handleDeleteEvent}
            activeGroupFilters={activeGroupFilters}
            onToggleGroupFilter={handleToggleGroupFilter}
            onClearFilters={() => setActiveGroupFilters([])}
            isLoggedIn={canCreateEvent}
            canManageEvent={canManageEvent}
          />
        )}
      </main>

      <GroupManagerModal
        isOpen={isGroupManagerModalOpen}
        onClose={() => setIsGroupManagerModalOpen(false)}
        groups={groups}
        onAddGroup={handleAddGroup}
        onUpdateGroup={handleUpdateGroup}
        onDeleteGroup={handleDeleteGroup}
      />

      <EventFormModal
        isOpen={isEventModalOpen}
        onClose={() => {
          setIsEventModalOpen(false);
          setEditingEvent(null);
        }}
        groups={groups}
        selectedDate={selectedDate}
        editingEvent={editingEvent}
        currentUserName={user?.name}
        onSave={handleSaveEvent}
      />

      <SupabaseConfigModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
        currentConfig={supabaseConfig}
        groups={INITIAL_GROUPS}
        onSaveConfig={handleSaveSupabaseConfig}
      />

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLogin={handleLogin}
      />

      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2 font-sans">ยืนยันการลบ</h3>
              <p className="text-slate-500 text-sm font-sans mb-6">คุณต้องการลบกิจกรรมการประชุมนี้ใช่หรือไม่? การลบไม่สามารถเรียกคืนข้อมูลได้</p>
              <div className="flex flex-col gap-2">
                <button type="button" onClick={executeDelete} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-xl transition-colors shadow-sm">
                  ใช่, ลบเลย
                </button>
                <button type="button" onClick={() => setConfirmDeleteId(null)} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl transition-colors">
                  ยกเลิก
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
              x
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
