import assert from "node:assert/strict";
import test from "node:test";
import { MAX_PARTICIPANT_PDF_BYTES, validateParticipantPdf } from "../src/utils/participantPdfValidation.ts";

test("accepts a PDF with an uppercase extension or no browser MIME type", async () => {
  assert.equal(await validateParticipantPdf(new File(["%PDF-1.4\n%%EOF"], "รายชื่อ.PDF", { type: "application/pdf" })), null);
  assert.equal(await validateParticipantPdf(new File(["%PDF-1.4\n%%EOF"], "รายชื่อ.pdf")), null);
});

test("rejects a renamed non-PDF even when the browser reports a PDF MIME type", async () => {
  assert.match(await validateParticipantPdf(new File(["not a PDF"], "list.pdf", { type: "application/pdf" })) || "", /ไม่ใช่ PDF/);
});

test("rejects incompatible extensions and MIME types", async () => {
  assert.match(await validateParticipantPdf(new File(["%PDF-1.4"], "list.txt", { type: "application/pdf" })) || "", /PDF เท่านั้น/);
  assert.match(await validateParticipantPdf(new File(["%PDF-1.4"], "list.pdf", { type: "text/html" })) || "", /PDF เท่านั้น/);
});

test("rejects an empty file", async () => {
  assert.match(await validateParticipantPdf(new File([], "list.pdf")) || "", /ว่างเปล่า/);
});

test("accepts exactly 2 MiB but rejects one byte over the limit", async () => {
  const content = new Uint8Array(MAX_PARTICIPANT_PDF_BYTES);
  content.set(new TextEncoder().encode("%PDF-1.4"));
  assert.equal(await validateParticipantPdf(new File([content], "list.pdf")), null);
  assert.match(await validateParticipantPdf(new File([content, "x"], "list.pdf")) || "", /2 MB/);
});
