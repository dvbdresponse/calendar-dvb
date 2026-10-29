import assert from "node:assert/strict";
import test from "node:test";
import {
  getExternalPdfUrl,
  getPdfDownloadUrl,
  isLineBrowser,
} from "../src/utils/pdfLinks";

test("recognizes LINE on iOS and Android without matching unrelated words", () => {
  assert.equal(
    isLineBrowser("Mozilla/5.0 (iPhone) AppleWebKit Safari Line/15.0.1"),
    true,
  );
  assert.equal(
    isLineBrowser(
      "Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile Line/14.7.0",
    ),
    true,
  );
  assert.equal(isLineBrowser("Mozilla/5.0 Chrome/120 online/1"), false);
});

test("external-browser link preserves the signed token and other URL components", () => {
  const result = new URL(
    getExternalPdfUrl(
      "https://files.example/a.pdf?token=a%2Bb%2Fc&download=list.pdf#page=2",
    )!,
  );
  assert.equal(result.searchParams.get("token"), "a+b/c");
  assert.equal(result.searchParams.get("download"), "list.pdf");
  assert.equal(result.searchParams.get("openExternalBrowser"), "1");
  assert.equal(result.hash, "#page=2");
});

test("device-local and unsafe URLs are not offered to an external browser", () => {
  for (const url of [
    "blob:https://example.org/uuid",
    "javascript:alert(1)",
    "data:application/pdf,abc",
    "invalid",
  ]) {
    assert.equal(getExternalPdfUrl(url), null);
  }
});

test("download filename is encoded while preserving the signed token; blob URLs stay intact", () => {
  const result = new URL(
    getPdfDownloadUrl(
      "https://files.example/a.pdf?token=secret",
      "รายชื่อ.pdf",
    ),
  );
  assert.equal(result.searchParams.get("download"), "รายชื่อ.pdf");
  assert.equal(result.searchParams.get("token"), "secret");
  const blob = "blob:https://example.org/uuid";
  assert.equal(getPdfDownloadUrl(blob, "รายชื่อ.pdf"), blob);
});
