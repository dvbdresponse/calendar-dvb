export const MAX_PARTICIPANT_PDF_BYTES = 2 * 1024 * 1024;

export const validateParticipantPdf = async (file: File): Promise<string | null> => {
  if (!file.name.toLowerCase().endsWith(".pdf") || (file.type && file.type !== "application/pdf")) {
    return "กรุณาเลือกไฟล์ PDF เท่านั้น";
  }
  if (file.size === 0) return "ไฟล์นี้ว่างเปล่า กรุณาเลือกไฟล์ PDF ใหม่";
  if (file.size > MAX_PARTICIPANT_PDF_BYTES) return "ไฟล์ใหญ่เกิน 2 MB กรุณาลดขนาดไฟล์แล้วลองใหม่";
  const header = await file.slice(0, 5).text();
  return header === "%PDF-" ? null : "ไฟล์นี้ไม่ใช่ PDF ที่ถูกต้อง กรุณาเลือกไฟล์ใหม่";
};
