import { createClient, Session, SupabaseClient } from "@supabase/supabase-js";
import { Group, SupabaseConfig, UserSession } from "../types";

const CONFIG_KEY = "gov_calendar_supabase_config";

let cachedClient: SupabaseClient | null = null;
let cachedKey = "";

const envConfig = (): SupabaseConfig | null => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const tableName = import.meta.env.VITE_SUPABASE_EVENTS_TABLE || "events";

  if (!url || !anonKey) return null;
  return { url, anonKey, tableName };
};

export const getSupabaseConfig = (): SupabaseConfig | null => {
  try {
    const data = localStorage.getItem(CONFIG_KEY);
    return data ? JSON.parse(data) : envConfig();
  } catch (e) {
    console.error("Error reading Supabase config", e);
    return envConfig();
  }
};

export const saveSupabaseConfig = (config: SupabaseConfig | null) => {
  try {
    cachedClient = null;
    cachedKey = "";

    if (config) {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    } else {
      localStorage.removeItem(CONFIG_KEY);
    }
  } catch (e) {
    console.error("Error saving Supabase config", e);
  }
};

export const hasValidSupabaseConfig = (config: SupabaseConfig | null): config is SupabaseConfig => {
  if (!config?.url || !config?.anonKey) return false;
  try {
    new URL(config.url);
    return true;
  } catch {
    return false;
  }
};

export const createDynamicSupabaseClient = (config: SupabaseConfig): SupabaseClient => {
  const key = `${config.url}|${config.anonKey}`;
  if (cachedClient && cachedKey === key) return cachedClient;

  cachedClient = createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  cachedKey = key;
  return cachedClient;
};

export const getCurrentSession = async (client: SupabaseClient): Promise<Session | null> => {
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data.session;
};

export const signInWithPassword = async (
  client: SupabaseClient,
  email: string,
  password: string,
): Promise<Session> => {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (!data.session) throw new Error("Supabase did not return a session.");
  return data.session;
};

export const signOut = async (client: SupabaseClient) => {
  const { error } = await client.auth.signOut();
  if (error) throw error;
};

export const getUserProfile = async (
  client: SupabaseClient,
  session: Session | null,
): Promise<UserSession | null> => {
  if (!session?.user) return null;

  const { data, error } = await client
    .from("profiles")
    .select("id, email, display_name, role")
    .eq("id", session.user.id)
    .maybeSingle();

  if (error) throw error;

  const email = data?.email || session.user.email || "";
  const displayName =
    data?.display_name ||
    session.user.user_metadata?.display_name ||
    session.user.user_metadata?.name ||
    email ||
    "Supabase user";

  return {
    id: session.user.id,
    username: email,
    email,
    role: data?.role === "admin" ? "admin" : "officer",
    name: displayName,
  };
};

export const checkSupabaseConnection = async (url: string, key: string, tableName: string): Promise<boolean> => {
  try {
    if (!url || !key) return false;
    try {
      new URL(url);
    } catch {
      return false;
    }
    const client = createClient(url, key);
    const { error } = await client.from(tableName || "events").select("id").limit(1);
    if (error) {
      console.warn("Supabase check error:", error);
      return error.code === "42P01";
    }
    return true;
  } catch (e) {
    console.error("Connection check exception", e);
    return false;
  }
};

const groupValues = (groups: Group[]) =>
  groups
    .map((group) => {
      const safe = (value: string) => value.replaceAll("'", "''");
      return `  ('${safe(group.id)}', '${safe(group.name)}', '${safe(group.label)}', '${safe(group.color)}', '${safe(group.bgColor)}', '${safe(group.textColor)}', '${safe(group.borderColor)}')`;
    })
    .join(",\n");

export const buildSqlSchema = (groups: Group[]) => `-- Secure setup for the government calendar app.
-- Run this in Supabase SQL Editor, then create users in Authentication and add matching profile rows.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'officer' CHECK (role IN ('admin', 'officer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  label TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#cbd5e1',
  bg_color TEXT NOT NULL DEFAULT 'bg-slate-50',
  text_color TEXT NOT NULL DEFAULT 'text-slate-700',
  border_color TEXT NOT NULL DEFAULT 'border-slate-200',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  end_date DATE,
  start_time TEXT NOT NULL DEFAULT '',
  end_time TEXT NOT NULL DEFAULT '',
  group_id TEXT NOT NULL REFERENCES public.groups(id) ON UPDATE CASCADE,
  location TEXT,
  is_online BOOLEAN NOT NULL DEFAULT false,
  online_platform TEXT,
  is_holiday BOOLEAN NOT NULL DEFAULT false,
  created_by TEXT NOT NULL,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT events_end_date_not_before_start CHECK (end_date IS NULL OR end_date >= date)
);

CREATE INDEX IF NOT EXISTS events_date_idx ON public.events(date);
CREATE INDEX IF NOT EXISTS events_group_id_idx ON public.events(group_id);
CREATE INDEX IF NOT EXISTS events_created_by_user_id_idx ON public.events(created_by_user_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_groups_updated_at ON public.groups;
CREATE TRIGGER set_groups_updated_at
  BEFORE UPDATE ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_events_updated_at ON public.events;
CREATE TRIGGER set_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

INSERT INTO public.groups (id, name, label, color, bg_color, text_color, border_color)
VALUES
${groupValues(groups)}
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  label = EXCLUDED.label,
  color = EXCLUDED.color,
  bg_color = EXCLUDED.bg_color,
  text_color = EXCLUDED.text_color,
  border_color = EXCLUDED.border_color;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles are readable by signed in users" ON public.profiles;
CREATE POLICY "Profiles are readable by signed in users" ON public.profiles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can update own profile display name" ON public.profiles;
CREATE POLICY "Users can update own profile display name" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = public.current_user_role());

DROP POLICY IF EXISTS "Groups are publicly readable" ON public.groups;
CREATE POLICY "Groups are publicly readable" ON public.groups
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins manage groups" ON public.groups;
CREATE POLICY "Admins manage groups" ON public.groups
  FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "Events are publicly readable" ON public.events;
CREATE POLICY "Events are publicly readable" ON public.events
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users create events" ON public.events;
CREATE POLICY "Authenticated users create events" ON public.events
  FOR INSERT TO authenticated
  WITH CHECK (created_by_user_id = auth.uid());

DROP POLICY IF EXISTS "Owners and admins update events" ON public.events;
CREATE POLICY "Owners and admins update events" ON public.events
  FOR UPDATE TO authenticated
  USING (created_by_user_id = auth.uid() OR public.current_user_role() = 'admin')
  WITH CHECK (created_by_user_id = auth.uid() OR public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "Owners and admins delete events" ON public.events;
CREATE POLICY "Owners and admins delete events" ON public.events
  FOR DELETE TO authenticated
  USING (created_by_user_id = auth.uid() OR public.current_user_role() = 'admin');

-- After creating Supabase Auth users, grant app access with profile rows like:
-- INSERT INTO public.profiles (id, email, display_name, role)
-- VALUES ('USER_UUID_FROM_AUTH_USERS', 'admin@example.go.th', 'ผู้ดูแลระบบกลาง', 'admin');
`;
