import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import MeetingLink from "../src/components/MeetingLink";

test("expired meeting links expose a notice without a clickable URL in both styles", (context) => {
  context.mock.method(Date, "now", () => Date.parse("2026-10-29T12:00:00+07:00"));
  for (const button of [false, true]) {
    const html = renderToStaticMarkup(createElement(MeetingLink, {
      link: "https://example.org/meeting",
      meeting: { date: "2026-10-29", end_time: "12:00" },
      button,
    }));
    assert.match(html, /การประชุมสิ้นสุดแล้ว ไม่สามารถเปิดลิงก์ได้/);
    assert.match(html, /role="status"/);
    assert.doesNotMatch(html, /<a\b|href=|example\.org/);
  }
});

test("upcoming and ongoing meetings retain the normalized join link", (context) => {
  context.mock.method(Date, "now", () => Date.parse("2026-10-29T11:59:59+07:00"));
  for (const button of [false, true]) {
    const html = renderToStaticMarkup(createElement(MeetingLink, {
      link: "Https://example.org/meeting",
      meeting: { date: "2026-10-29", end_time: "12:00" },
      button,
    }));
    assert.match(html, /href="https:\/\/example\.org\/meeting"/);
    assert.match(html, /target="_blank"/);
    assert.doesNotMatch(html, /การประชุมสิ้นสุดแล้ว/);
  }
});

test("a missing schedule cannot bypass the meeting expiry check", () => {
  const html = renderToStaticMarkup(createElement(MeetingLink, {
    link: "https://example.org/meeting",
    meeting: { date: "", end_time: "" },
  }));
  assert.match(html, /ไม่พบเวลาสิ้นสุดที่ถูกต้อง/);
  assert.doesNotMatch(html, /<a\b|href=/);
});
