import attachmentSql from "../../supabase/migrations/202610280001_participant_pdfs.sql?raw";

export const buildParticipantPdfSql = (tableName = "events") => {
  const safeTableName = (tableName.trim() || "events").replaceAll('"', '""');
  return attachmentSql.replace("ALTER TABLE public.events", `ALTER TABLE public."${safeTableName}"`);
};
