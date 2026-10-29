import attachmentSql from "../../supabase/migrations/202610280001_participant_pdfs.sql?raw";
import publicReadSql from "../../supabase/migrations/202610290001_public_participant_pdfs.sql?raw";

export const buildParticipantPdfSql = (tableName = "events") => {
  const safeTableName = (tableName.trim() || "events").replaceAll('"', '""');
  return `${attachmentSql}\n${publicReadSql}`.replaceAll("public.events", `public."${safeTableName}"`);
};
