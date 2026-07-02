import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { SupabaseConfig } from "../types";

const CONFIG_KEY = "gov_calendar_supabase_config";

export const getSupabaseConfig = (): SupabaseConfig | null => {
  try {
    const data = localStorage.getItem(CONFIG_KEY);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error("Error reading Supabase config", e);
    return null;
  }
};

export const saveSupabaseConfig = (config: SupabaseConfig | null) => {
  try {
    if (config) {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    } else {
      localStorage.removeItem(CONFIG_KEY);
    }
  } catch (e) {
    console.error("Error saving Supabase config", e);
  }
};

// Instantiates a client dynamically
export const createDynamicSupabaseClient = (config: SupabaseConfig): SupabaseClient => {
  let url = config.url || "";
  try {
    new URL(url);
  } catch (e) {
    url = "https://placeholder-invalid-url.supabase.co";
  }
  return createClient(url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    }
  });
};

export const checkSupabaseConnection = async (url: string, key: string, tableName: string): Promise<boolean> => {
  try {
    if (!url || !key) return false;
    try {
      new URL(url);
    } catch (e) {
      return false;
    }
    const client = createClient(url, key);
    // Try to fetch 1 row from the table to see if it exists and credentials are correct
    const { error } = await client.from(tableName || "events").select("id").limit(1);
    if (error) {
      console.warn("Supabase check error:", error);
      // If error is code 42P01, it means the table doesn't exist, but connection is active!
      if (error.code === "42P01") {
        // Table does not exist, but URL/Key are valid
        return true;
      }
      return false;
    }
    return true;
  } catch (e) {
    console.error("Connection check exception", e);
    return false;
  }
};

export const SQL_SCHEMA = `-- 1. สร้างตารางเก็บข้อมูลกิจกรรมการประชุม (events)
CREATE TABLE IF NOT EXISTS public.events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  group_id TEXT NOT NULL,
  location TEXT,
  is_online BOOLEAN DEFAULT false,
  online_platform TEXT,
  is_holiday BOOLEAN DEFAULT false,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. เปิดใช้งาน Row Level Security (RLS) เพื่อความปลอดภัย
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- 3. สร้างนโยบายการเข้าถึงข้อมูล (RLS Policies)
-- นโยบายสำหรับการเปิดให้ทุกคนสามารถ ดึงข้อมูลได้ (Read)
CREATE POLICY "Allow public read access" ON public.events
  FOR SELECT USING (true);

-- นโยบายสำหรับการเปิดให้ทุกคนสามารถ เพิ่มข้อมูลได้ (Insert)
CREATE POLICY "Allow public insert" ON public.events
  FOR INSERT WITH CHECK (true);

-- นโยบายสำหรับการเปิดให้ทุกคนสามารถ แก้ไขข้อมูลได้ (Update)
CREATE POLICY "Allow public update" ON public.events
  FOR UPDATE USING (true);

-- นโยบายสำหรับการเปิดให้ทุกคนสามารถ ลบข้อมูลได้ (Delete)
CREATE POLICY "Allow public delete" ON public.events
  FOR DELETE USING (true);

-- 4. เปิดใช้งาน Realtime เพื่อให้ข้อมูลอัปเดตแบบเรียลไทม์ (เลือกได้ในแดชบอร์ด Supabase)
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
`;
