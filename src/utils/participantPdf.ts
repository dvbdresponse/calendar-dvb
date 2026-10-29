import { SupabaseConfig } from "../types";
import { createDynamicSupabaseClient, getCurrentSession, hasValidSupabaseConfig } from "./supabaseClient";
import { validateParticipantPdf } from "./participantPdfValidation";
export { validateParticipantPdf } from "./participantPdfValidation";

export const PARTICIPANT_PDF_BUCKET = "meeting-participants";
export const PARTICIPANT_PDF_FILENAME = "รายชื่อผู้เข้าร่วมประชุม.pdf";

export interface ParticipantPdfChange {
  file: File | null;
  remove: boolean;
}

const openLocalPdfDatabase = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const request = indexedDB.open("gov_calendar_attachments", 1);
  request.onupgradeneeded = () => request.result.createObjectStore("pdfs");
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(new Error("เปิดพื้นที่เก็บไฟล์ในเบราว์เซอร์ไม่ได้ กรุณาตรวจสอบสิทธิ์พื้นที่จัดเก็บ"));
});

const useLocalPdfStore = async <T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const database = await openLocalPdfDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction("pdfs", mode);
      const request = operation(transaction.objectStore("pdfs"));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(new Error("จัดเก็บไฟล์ไม่สำเร็จ พื้นที่ในเบราว์เซอร์อาจเต็ม"));
      transaction.onerror = () => reject(new Error("อ่านหรือเขียนไฟล์ไม่สำเร็จ กรุณาลองใหม่"));
    });
  } finally {
    database.close();
  }
};

const storageError = (message: string) => {
  if (/bucket|row.level|policy|permission|not found/i.test(message)) {
    return new Error("ยังเปิดไฟล์แนบไม่ได้ กรุณาแจ้งผู้ดูแลให้ตรวจสอบไฟล์และสิทธิ์อ่านรายชื่อผู้เข้าร่วม");
  }
  return new Error(`จัดการไฟล์ PDF ไม่สำเร็จ: ${message}`);
};

export const uploadParticipantPdf = async (file: File, config: SupabaseConfig | null): Promise<string> => {
  const validationError = await validateParticipantPdf(file);
  if (validationError) throw new Error(validationError);

  if (!hasValidSupabaseConfig(config)) {
    const path = `local/${crypto.randomUUID()}.pdf`;
    await useLocalPdfStore("readwrite", (store) => store.put(file, path));
    return path;
  }

  const client = createDynamicSupabaseClient(config);
  const session = await getCurrentSession(client);
  if (!session) throw new Error("กรุณาเข้าสู่ระบบก่อนแนบไฟล์ PDF");
  const path = `${session.user.id}/${crypto.randomUUID()}.pdf`;
  const { error } = await client.storage.from(PARTICIPANT_PDF_BUCKET).upload(path, file, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (error) throw storageError(error.message);
  return path;
};

export const removeParticipantPdf = async (path: string, config: SupabaseConfig | null): Promise<void> => {
  if (!hasValidSupabaseConfig(config)) {
    await useLocalPdfStore("readwrite", (store) => store.delete(path));
    return;
  }
  const { error } = await createDynamicSupabaseClient(config).storage.from(PARTICIPANT_PDF_BUCKET).remove([path]);
  if (error) throw storageError(error.message);
};

export const getParticipantPdfUrl = async (path: string, config: SupabaseConfig | null, download = false): Promise<string> => {
  if (!hasValidSupabaseConfig(config)) {
    const blob = await useLocalPdfStore<Blob | undefined>("readonly", (store) => store.get(path));
    if (!blob) throw new Error("ไม่พบไฟล์ในเบราว์เซอร์นี้ ไฟล์ทดลองเปิดได้จากเครื่องและเบราว์เซอร์ที่แนบเท่านั้น");
    return URL.createObjectURL(blob);
  }
  const client = createDynamicSupabaseClient(config);
  const { data, error } = await client.storage.from(PARTICIPANT_PDF_BUCKET).createSignedUrl(path, 600, {
    ...(download ? { download: PARTICIPANT_PDF_FILENAME } : {}),
  });
  if (error) throw storageError(error.message);
  return data.signedUrl;
};
