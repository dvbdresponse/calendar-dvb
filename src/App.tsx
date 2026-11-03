import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Database, RefreshCw, X } from "lucide-react";
import { EventData, Group, SupabaseConfig, UserSession } from "./types";
import { MOCK_EVENTS, GROUPS as INITIAL_GROUPS, THAI_HOLIDAYS_2026 } from "./data/constants";
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
import ParticipantPdfViewer from "./components/ParticipantPdfViewer";
import { findBookingConflict } from "./utils/booking";
import { getParticipantPdfUrl, PARTICIPANT_PDF_FILENAME, ParticipantPdfChange, removeParticipantPdf, uploadParticipantPdf } from "./utils/participantPdf";
import { isLineBrowser } from "./utils/pdfLinks";

const MeetingStatsDashboard = lazy(() => import("./components/MeetingStatsDashboard"));

const EVENTS_STORAGE_KEY = "gov_calendar_local_events";
const GROUPS_STORAGE_KEY = "gov_calendar_groups";
const LEGACY_SESSION_KEY = "gov_calendar_user_session";
const LOCAL_HOLIDAY_SEED_KEY = "gov_calendar_holiday_seed_2026_done";
const SUPABASE_HOLIDAY_SEED_PREFIX = "gov_calendar_supabase_holiday_seed_2026_done";

const getSupabaseHolidaySeedKey = (config: SupabaseConfig) => (
  `${SUPABASE_HOLIDAY_SEED_PREFIX}:${config.url}:${config.tableName || "events"}`
);

const looksLikeOnlineLink = (value: string) => {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.startsWith("http://") ||
    normalized.startsWith("https://") ||
    normalized.startsWith("www.") ||
    normalized.includes(".zoom.us") ||
    normalized.includes("webex.com")
  );
};

const normalizeEvent = (evt: any): EventData => {
  const location = evt.location || "";
  const isOnline = evt.is_online === true || evt.is_online === "true";
  const legacyLocationLink = isOnline && !evt.online_link && looksLikeOnlineLink(location);

  return {
    id: evt.id,
    title: evt.title,
    description: evt.description || "",
    date: evt.date,
    end_date: evt.end_date || undefined,
    start_time: evt.start_time || "",
    end_time: evt.end_time || "",
    group_id: evt.group_id,
    location: legacyLocationLink ? "" : location,
    is_online: isOnline,
    online_platform: evt.online_platform || "",
    online_link: evt.online_link || (legacyLocationLink ? location : ""),
    online_resource: evt.online_resource || "",
    participant_pdf_path: evt.participant_pdf_path ?? undefined,
    is_holiday: evt.is_holiday === true || evt.is_holiday === "true",
    created_by: evt.created_by || "ผู้ลงบันทึก",
    created_by_user_id: evt.created_by_user_id || undefined,
    created_at: evt.created_at,
    updated_at: evt.updated_at || undefined,
  };
};

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

const buildHolidaySeedEvents = (existingEvents: EventData[], groupList: Group[]) => {
  const defaultGroupId = groupList[0]?.id || INITIAL_GROUPS[0]?.id || "office";
  const existingKeys = new Set(
    existingEvents
      .filter((event) => event.is_holiday)
      .map((event) => `${event.date}|${event.title}`)
  );

  return THAI_HOLIDAYS_2026
    .filter((holiday) => !existingKeys.has(`${holiday.date}|${holiday.name}`))
    .map((holiday, index) => ({
      id: `thai-holiday-2026-${holiday.date}-${index}`,
      title: holiday.name,
      description: "",
      date: holiday.date,
      start_time: "",
      end_time: "",
      group_id: defaultGroupId,
      location: "",
      is_online: false,
      online_platform: "",
      online_link: "",
      online_resource: "",
      is_holiday: true,
      created_by: "ระบบ",
      created_at: new Date().toISOString(),
    } as EventData));
};

const eventToSupabasePayload = (event: Omit<EventData, "id" | "created_at"> & { id?: string; created_at?: string }) => ({
  title: event.title,
  description: event.description,
  date: event.date,
  end_date: event.end_date || null,
  start_time: event.start_time,
  end_time: event.end_time,
  group_id: event.group_id,
  location: event.location,
  is_online: event.is_online,
  online_platform: event.online_platform || "",
  online_link: event.online_link || "",
  online_resource: event.online_resource || "",
  ...(event.participant_pdf_path !== undefined ? { participant_pdf_path: event.participant_pdf_path } : {}),
  is_holiday: event.is_holiday,
  created_by: event.created_by,
  created_by_user_id: event.created_by_user_id,
});

const seedSupabaseHolidayEvents = async (
  client: any,
  config: SupabaseConfig,
  tableName: string,
  existingEvents: EventData[],
  groupList: Group[],
) => {
  const seedKey = getSupabaseHolidaySeedKey(config);
  if (localStorage.getItem(seedKey) === "true") {
    return { events: existingEvents, error: null as string | null };
  }

  const session = await getCurrentSession(client);
  if (!session) {
    return { events: existingEvents, error: null as string | null };
  }

  const seedEvents = buildHolidaySeedEvents(existingEvents, groupList);
  if (seedEvents.length === 0) {
    localStorage.setItem(seedKey, "true");
    return { events: existingEvents, error: null as string | null };
  }

  const { error } = await client.from(tableName).insert(seedEvents.map(eventToSupabasePayload));
  if (error) {
    console.error("Supabase Holiday Seed Error", error);
    return { events: existingEvents, error: formatSupabaseWriteError(error.message || "", tableName) };
  }

  localStorage.setItem(seedKey, "true");
  return { events: [...existingEvents, ...seedEvents], error: null as string | null };
};

const formatSupabaseWriteError = (message: string, tableName: string) => {
  if (message.toLowerCase().includes("row-level security")) {
    return `Supabase RLS ยังบล็อกตาราง ${tableName}: กรุณาคัดลอก SQL Schema ล่าสุดจากหน้าตั้งค่าฐานข้อมูลไปรันใน Supabase SQL Editor`;
  }
  return message || "เกิดข้อผิดพลาด";
};

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
  const [participantPdfPath, setParticipantPdfPath] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"calendar" | "analytics">("calendar");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeGroupFilters, setActiveGroupFilters] = useState<string[]>([]);
  const [supabaseConfig, setSupabaseConfigState] = useState<SupabaseConfig | null>(getSupabaseConfig());
  const [isDbLoading, setIsDbLoading] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [holidaySeedError, setHolidaySeedError] = useState<string | null>(null);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isGroupManagerModalOpen, setIsGroupManagerModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventData | null>(null);
  const [duplicatingEvent, setDuplicatingEvent] = useState<EventData | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<{ id: string; message: string; type: "success" | "error" | "info" }[]>([]);

  const isSupabaseMode = hasValidSupabaseConfig(supabaseConfig);
  const canCreateEvent = !isSupabaseMode || !!user;
  const canManageGroups = isSupabaseMode && !!user;

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
      const savedGroups = localStorage.getItem(GROUPS_STORAGE_KEY);
      const nextGroups = savedGroups ? JSON.parse(savedGroups) : INITIAL_GROUPS;
      let nextEvents: EventData[];

      if (saved) {
        nextEvents = JSON.parse(saved);
      } else {
        nextEvents = MOCK_EVENTS;
      }

      nextEvents = nextEvents.map(normalizeEvent);

      if (!localStorage.getItem(LOCAL_HOLIDAY_SEED_KEY)) {
        const seedEvents = buildHolidaySeedEvents(nextEvents, nextGroups);
        nextEvents = [...nextEvents, ...seedEvents];
        localStorage.setItem(LOCAL_HOLIDAY_SEED_KEY, "true");
      }

      localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(nextEvents));
      setEvents(nextEvents);
      setGroups(nextGroups);
    } catch (e) {
      console.error("Failed to load local storage", e);
      const fallbackEvents = localStorage.getItem(LOCAL_HOLIDAY_SEED_KEY)
        ? MOCK_EVENTS.map(normalizeEvent)
        : [...MOCK_EVENTS.map(normalizeEvent), ...buildHolidaySeedEvents(MOCK_EVENTS, INITIAL_GROUPS)];
      localStorage.setItem(LOCAL_HOLIDAY_SEED_KEY, "true");
      localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(fallbackEvents));
      setEvents(fallbackEvents);
      setGroups(INITIAL_GROUPS);
    }
  }, []);

  const loadData = useCallback(async (config: SupabaseConfig | null, options?: { quiet?: boolean }) => {
    setIsDbLoading(true);
    setDbError(null);
    setHolidaySeedError(null);

    if (hasValidSupabaseConfig(config)) {
      try {
        const client = createDynamicSupabaseClient(config);
        const tableName = config.tableName || "events";

        const [eventsResult, groupsResult] = await Promise.all([
          client.from(tableName).select("*").order("date", { ascending: true }).order("start_time", { ascending: true }),
          client.from("groups").select("*").order("id", { ascending: true }),
        ]);

        if (eventsResult.error) throw eventsResult.error;
        if (groupsResult.error) throw groupsResult.error;

        let nextEvents = (eventsResult.data || []).map(normalizeEvent);
        const nextGroups = (groupsResult.data && groupsResult.data.length > 0 ? groupsResult.data : INITIAL_GROUPS).map(normalizeGroup);
        const seedResult = await seedSupabaseHolidayEvents(client, config, tableName, nextEvents, nextGroups);
        nextEvents = seedResult.events;
        setHolidaySeedError(seedResult.error);

        setEvents(nextEvents);
        setGroups(nextGroups);

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
      setHolidaySeedError(null);
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
    if (!isSupabaseMode) return true;
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
    return true;
  };

  const canManageEvent = useCallback((event: EventData) => {
    return !isSupabaseMode || !!user;
  }, [isSupabaseMode, user]);

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
    const conflict = findBookingConflict(formData as EventData, events);
    if (conflict) {
      return `${conflict.resourceName} ถูกจองแล้วในช่วงเวลาเดียวกัน: ${conflict.event.title}`;
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
    await loadData(supabaseConfig, { quiet: true });
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

  const cleanupParticipantPdf = async (path: string) => {
    try {
      await removeParticipantPdf(path, supabaseConfig);
    } catch (error) {
      console.error("PDF cleanup failed", error);
      showToast("บันทึกข้อมูลแล้ว แต่ลบไฟล์ที่ไม่ได้ใช้งานไม่สำเร็จ กรุณาตรวจพื้นที่แนบไฟล์", "info");
    }
  };

  const handleOpenParticipantPdf = async (path: string, download = false) => {
    if (!download || isLineBrowser(navigator.userAgent)) {
      setParticipantPdfPath(path);
      return;
    }
    try {
      const url = await getParticipantPdfUrl(path, supabaseConfig, download);
      const link = document.createElement("a");
      link.href = url;
      link.download = PARTICIPANT_PDF_FILENAME;
      document.body.appendChild(link);
      link.click();
      link.remove();
      if (url.startsWith("blob:")) setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error: any) {
      showToast(error.message || "เปิดไฟล์ PDF ไม่สำเร็จ กรุณาลองใหม่", "error");
    }
  };

  const handleSaveEvent = async (
    formData: Omit<EventData, "id" | "created_at"> & { id?: string },
    attachment: ParticipantPdfChange,
  ): Promise<boolean> => {
    const validationError = validateEventPayload(formData);
    if (validationError) {
      showToast(validationError, "error");
      return false;
    }

    const currentEvent = formData.id ? events.find((item) => item.id === formData.id) : null;
    const itemLabel = formData.is_holiday ? "วันหยุด" : "กิจกรรม";
    if (!ensureCanWriteEvent(currentEvent)) return false;
    const previousPath = currentEvent?.participant_pdf_path;
    let uploadedPath: string | null = null;
    let saved = false;

    try {
      setIsDbLoading(true);
      const nextData = { ...formData };
      if (previousPath) nextData.participant_pdf_path = previousPath;
      if (attachment.file) {
        uploadedPath = await uploadParticipantPdf(attachment.file, supabaseConfig);
        nextData.participant_pdf_path = uploadedPath;
      } else if (attachment.remove) {
        nextData.participant_pdf_path = null;
      }

      if (hasValidSupabaseConfig(supabaseConfig)) {
        const client = createDynamicSupabaseClient(supabaseConfig);
        const tableName = supabaseConfig.tableName || "events";
        const payload = eventToSupabasePayload({
          ...nextData,
          created_by_user_id: currentEvent?.created_by_user_id || user?.id,
        });

        const { error } = formData.id
          ? await client.from(tableName).update(payload).eq("id", formData.id).select("id").single()
          : await client.from(tableName).insert([payload]).select("id").single();

        if (error) throw error;
      } else {
        const updatedList = formData.id
          ? events.map((item) => item.id === formData.id ? { ...item, ...nextData } as EventData : item)
          : [
            ...events,
            {
              ...nextData,
              id: `evt-${crypto.randomUUID()}`,
              created_at: new Date().toISOString(),
            } as EventData,
          ];
        localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(updatedList));
        setEvents(updatedList);
      }
      saved = true;
      showToast(formData.id ? `แก้ไข${itemLabel}เรียบร้อยแล้ว` : `เพิ่ม${itemLabel}เรียบร้อยแล้ว`, "success");
      if (previousPath && previousPath !== nextData.participant_pdf_path && !events.some((event) => event.id !== formData.id && event.participant_pdf_path === previousPath)) {
        await cleanupParticipantPdf(previousPath);
      }
      if (hasValidSupabaseConfig(supabaseConfig)) await loadData(supabaseConfig, { quiet: true });
      return true;
    } catch (error: any) {
      if (uploadedPath && !saved) await cleanupParticipantPdf(uploadedPath);
      const message = /participant_pdf_path/i.test(error.message || "")
        ? "กรุณารัน SQL สำหรับแนบ PDF จากหน้าตั้งค่าฐานข้อมูลก่อน แล้วกดบันทึกอีกครั้ง"
        : error.message || "เกิดข้อผิดพลาด กรุณาลองใหม่";
      showToast(`บันทึกข้อมูลล้มเหลว: ${message}`, "error");
      return false;
    } finally {
      setIsDbLoading(false);
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
    const itemLabel = currentEvent?.is_holiday ? "วันหยุด" : "กิจกรรม";
    setConfirmDeleteId(null);
    if (!ensureCanWriteEvent(currentEvent)) return;

    if (hasValidSupabaseConfig(supabaseConfig)) {
      try {
        setIsDbLoading(true);
        const client = createDynamicSupabaseClient(supabaseConfig);
        const { error } = await client.from(supabaseConfig.tableName || "events").delete().eq("id", id).select("id").single();
        if (error) throw error;
        if (currentEvent?.participant_pdf_path && !events.some((event) => event.id !== id && event.participant_pdf_path === currentEvent.participant_pdf_path)) {
          await cleanupParticipantPdf(currentEvent.participant_pdf_path);
        }
        showToast(`ลบ${itemLabel}ใน Supabase สำเร็จ`, "success");
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
    localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(updatedList));
    setEvents(updatedList);
    if (currentEvent?.participant_pdf_path && !updatedList.some((event) => event.participant_pdf_path === currentEvent.participant_pdf_path)) {
      await cleanupParticipantPdf(currentEvent.participant_pdf_path);
    }
    showToast(`ลบ${itemLabel}ในเครื่องเรียบร้อยแล้ว`, "success");
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
      showToast("ต้องเข้าสู่ระบบผ่าน Supabase Auth เพื่อจัดการกลุ่มงาน", "error");
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
        showToast(`เพิ่มกลุ่มงานล้มเหลว: ${formatSupabaseWriteError(e.message || "", "groups")}`, "error");
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
      showToast("ต้องเข้าสู่ระบบผ่าน Supabase Auth เพื่อจัดการกลุ่มงาน", "error");
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
        showToast(`แก้ไขกลุ่มงานล้มเหลว: ${formatSupabaseWriteError(e.message || "", "groups")}`, "error");
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
      showToast("ต้องเข้าสู่ระบบผ่าน Supabase Auth เพื่อจัดการกลุ่มงาน", "error");
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
        showToast(`ลบกลุ่มงานล้มเหลว: ${formatSupabaseWriteError(e.message || "", "groups")}`, "error");
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
      (evt.online_link || "").toLowerCase().includes(term) ||
      (evt.created_by || "").toLowerCase().includes(term)
    ));
  }, [events, searchTerm]);

  const handleToggleGroupFilter = (groupId: string) => {
    setActiveGroupFilters((prev) => (
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    ));
  };

  const handleRetryHolidaySeed = async () => {
    if (!hasValidSupabaseConfig(supabaseConfig)) return;
    if (!user) {
      setIsLoginModalOpen(true);
      return;
    }

    const tableName = supabaseConfig.tableName || "events";
    setIsDbLoading(true);
    setHolidaySeedError(null);

    try {
      const client = createDynamicSupabaseClient(supabaseConfig);
      const seedResult = await seedSupabaseHolidayEvents(client, supabaseConfig, tableName, events, groups);
      setEvents(seedResult.events);
      setHolidaySeedError(seedResult.error);

      if (seedResult.error) {
        showToast("ยังนำเข้าวันหยุดราชการไม่สำเร็จ กรุณาตรวจสอบ RLS policy ใน Supabase", "error");
      } else {
        showToast("นำเข้าวันหยุดราชการสำเร็จ", "success");
      }
    } catch (e: any) {
      console.error("Retry Holiday Seed Error", e);
      setHolidaySeedError(formatSupabaseWriteError(e.message || "", tableName));
      showToast("นำเข้าวันหยุดราชการไม่สำเร็จ", "error");
    } finally {
      setIsDbLoading(false);
    }
  };

  const confirmDeleteEvent = confirmDeleteId ? events.find((event) => event.id === confirmDeleteId) : null;
  const confirmDeleteLabel = confirmDeleteEvent?.is_holiday ? "วันหยุด" : "กิจกรรมการประชุม";

  return (
    <div className="min-h-screen bg-slate-50 pb-16 font-sans text-slate-800 antialiased">
      <a href="#main-content" className="skip-link">ข้ามไปยังปฏิทินและเนื้อหา</a>
      <Header
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        supabaseConfig={supabaseConfig}
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
          setDuplicatingEvent(null);
          setIsEventModalOpen(true);
        }}
        onOpenGroupManagerModal={() => {
          if (!canManageGroups) {
            if (!isSupabaseMode) {
              showToast("ต้องเชื่อมต่อ Supabase ก่อนจัดการกลุ่มงาน", "error");
              setIsSupabaseModalOpen(true);
            } else {
              showToast("ต้องเข้าสู่ระบบผ่าน Supabase Auth เพื่อจัดการกลุ่มงาน", "error");
              if (!user) setIsLoginModalOpen(true);
            }
            return;
          }
          setIsGroupManagerModalOpen(true);
        }}
        totalEvents={events.filter((event) => !event.is_holiday).length}
        user={user}
        isAuthLoading={isAuthLoading}
        canCreateEvent={canCreateEvent}
        canManageGroups={canManageGroups}
        onOpenLoginModal={() => setIsLoginModalOpen(true)}
        onLogout={handleLogout}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <main id="main-content" tabIndex={-1} className="mx-auto mt-4 min-w-0 max-w-7xl space-y-4 px-4 focus:outline-none sm:mt-6 sm:px-6 lg:px-8">
        {isDbLoading && (
          <div role="status" className="fixed left-1/2 top-20 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-4 py-2 text-sm font-medium text-slate-700 shadow-lg shadow-slate-900/5 backdrop-blur">
            <RefreshCw className="h-4 w-4 animate-spin text-red-600" aria-hidden="true" />
            {isSupabaseMode ? "กำลังซิงค์ข้อมูลกับ Supabase..." : "กำลังโหลดข้อมูล..."}
          </div>
        )}

        {dbError && (
          <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-red-900">เชื่อมต่อ Supabase ไม่สำเร็จ</p>
              <p className="mt-0.5 text-sm text-red-700">{dbError}</p>
              <p className="mt-1 text-xs text-red-600/80">ระบบจะไม่บันทึกลงเครื่องอัตโนมัติ เพื่อป้องกันข้อมูลแยกคนละแหล่ง</p>
            </div>
            <button
              id="retry-connection-banner-btn"
              type="button"
              onClick={() => loadData(supabaseConfig)}
              className="shrink-0 rounded-xl bg-red-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              ลองใหม่
            </button>
          </div>
        )}

        {holidaySeedError && !dbError && (
          <div className="flex flex-col justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-start">
            <div className="flex min-w-0 items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-amber-900">นำเข้าวันหยุดราชการไม่สำเร็จ</p>
                <p className="mt-0.5 text-sm text-amber-800">{holidaySeedError}</p>
                <p className="mt-1 text-xs text-amber-700">
                  ปฏิทินยังอ่านข้อมูลได้ตามปกติ แต่ต้องรัน SQL Schema/RLS ล่าสุดใน Supabase SQL Editor ก่อน
                </p>
                <code className="mt-2 block overflow-x-auto rounded-lg border border-amber-200 bg-white/70 px-2 py-1 text-[11px] text-amber-900">
                  CREATE POLICY "Authenticated users create events" ON public.events FOR INSERT TO authenticated WITH CHECK (true);
                </code>
              </div>
            </div>
            <div className="flex shrink-0 gap-2 sm:flex-col">
              <button
                type="button"
                onClick={handleRetryHolidaySeed}
                className="whitespace-nowrap rounded-xl bg-amber-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-amber-700"
              >
                ลองนำเข้าอีกครั้ง
              </button>
              <button
                type="button"
                onClick={() => setIsSupabaseModalOpen(true)}
                className="whitespace-nowrap rounded-xl border border-amber-200 bg-white px-3.5 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100"
              >
                เปิด SQL Schema
              </button>
            </div>
          </div>
        )}

        {!isSupabaseMode && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50 to-orange-50/60 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <Database className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-amber-900">โหมดทดลอง (Local Demo)</p>
                <p className="hidden text-xs text-amber-800/80 sm:block">ข้อมูลเก็บเฉพาะเบราว์เซอร์นี้ เชื่อมต่อ Supabase เพื่อใช้งานร่วมกันทั้งหน่วยงาน</p>
              </div>
            </div>
            <button
              id="connect-supabase-banner-btn"
              type="button"
              onClick={() => setIsSupabaseModalOpen(true)}
              className="shrink-0 whitespace-nowrap rounded-xl bg-amber-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700"
            >
              ตั้งค่า Supabase
            </button>
          </div>
        )}

        {isSupabaseMode && !user && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-sky-900">ดูปฏิทินได้โดยไม่ต้องเข้าสู่ระบบ</p>
              <p className="mt-0.5 hidden text-xs text-sky-800 sm:block">เข้าสู่ระบบด้วยบัญชีหน่วยงานเพื่อเพิ่มหรือแก้ไขกิจกรรม</p>
            </div>
            <button
              type="button"
              onClick={() => setIsLoginModalOpen(true)}
              className="shrink-0 whitespace-nowrap rounded-xl bg-sky-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-sky-800"
            >
              เข้าสู่ระบบ
            </button>
          </div>
        )}

        {searchTerm && (
          <div role="status" className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2.5">
            <p className="event-copy min-w-0 text-sm text-slate-600">
              ผลการค้นหา <strong className="font-semibold text-slate-900">&ldquo;{searchTerm}&rdquo;</strong>
              <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">{filteredEvents.length} รายการ</span>
            </p>
            <button
              id="clear-search-btn"
              type="button"
              onClick={() => setSearchTerm("")}
              className="shrink-0 rounded-xl px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50"
            >
              ล้างการค้นหา
            </button>
          </div>
        )}

        {activeTab === "analytics" ? (
          <Suspense fallback={<div className="rounded-2xl border border-slate-200/70 bg-white p-6 text-sm text-slate-500">กำลังโหลดรายงานสถิติ...</div>}>
            <MeetingStatsDashboard events={events} groups={groups} />
          </Suspense>
        ) : (
          <CalendarView
            searchTerm={searchTerm}
            onClearSearch={() => setSearchTerm("")}
            onRequestLogin={() => setIsLoginModalOpen(true)}
            events={filteredEvents}
            groups={groups}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onEditEvent={(evt) => {
              if (!ensureCanWriteEvent(evt)) return;
              setDuplicatingEvent(null);
              setEditingEvent(evt);
              setIsEventModalOpen(true);
            }}
            onDuplicateEvent={(evt) => {
              if (!ensureCanWriteEvent(evt)) return;
              setEditingEvent(null);
              setDuplicatingEvent(evt);
              setIsEventModalOpen(true);
            }}
            onDeleteEvent={handleDeleteEvent}
            onOpenParticipantPdf={handleOpenParticipantPdf}
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
          setDuplicatingEvent(null);
        }}
        groups={groups}
        events={events}
        selectedDate={selectedDate}
        editingEvent={editingEvent}
        duplicatingEvent={duplicatingEvent}
        currentUserName={user?.name}
        isLocalMode={!isSupabaseMode}
        onOpenParticipantPdf={handleOpenParticipantPdf}
        onSave={handleSaveEvent}
      />

      {participantPdfPath && (
        <ParticipantPdfViewer path={participantPdfPath} config={supabaseConfig} onClose={() => setParticipantPdfPath(null)} />
      )}

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
              <p className="text-slate-500 text-sm font-sans mb-6">คุณต้องการลบ{confirmDeleteLabel}นี้ใช่หรือไม่? การลบไม่สามารถเรียกคืนข้อมูลได้</p>
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

      <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-96">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.type === "error" ? "alert" : "status"}
            className="pointer-events-auto flex w-full items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 text-sm text-slate-700 shadow-xl shadow-slate-900/10"
          >
            <span
              aria-hidden="true"
              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                toast.type === "success" ? "bg-emerald-500" : toast.type === "error" ? "bg-red-500" : "bg-sky-500"
              }`}
            />
            <span className="min-w-0 flex-1 leading-relaxed">{toast.message}</span>
            <button
              type="button"
              aria-label="ปิดการแจ้งเตือน"
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="-m-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
