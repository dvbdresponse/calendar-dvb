export interface Group {
  id: string;
  name: string;
  label: string; // Thai short name e.g. กบท
  color: string; // Main solid hex code
  bgColor: string; // Light background tailwind class or hex
  textColor: string; // Dark text tailwind class or hex
  borderColor: string; // Border color class or hex
}

export interface EventData {
  id: string;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  end_date?: string; // YYYY-MM-DD (Optional for multi-day events)
  start_time: string; // HH:MM
  end_time: string; // HH:MM
  group_id: string; // Group ID
  location: string;
  is_online: boolean;
  online_platform?: string;
  is_holiday: boolean;
  created_by: string;
  created_at: string;
}

export interface Holiday {
  date: string; // YYYY-MM-DD
  name: string; // Holiday Name in Thai
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  tableName: string;
}

export interface UserSession {
  username: string;
  role: "admin" | "officer";
  name: string;
}

