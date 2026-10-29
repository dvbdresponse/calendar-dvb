import assert from "node:assert/strict";
import test from "node:test";
import { getMeetingUrl } from "../src/utils/meetingUrl";

test("normalizes mixed-case schemes without prefixing a second scheme", () => {
  assert.equal(getMeetingUrl(" Https://test.com "), "https://test.com/");
  assert.equal(getMeetingUrl("HTTP://example.org/meeting?id=1#join"), "http://example.org/meeting?id=1#join");
});

test("preserves meeting tokens and supports domain-only links", () => {
  assert.equal(getMeetingUrl("zoom.us/j/123?pwd=abc%2Bdef"), "https://zoom.us/j/123?pwd=abc%2Bdef");
  assert.equal(getMeetingUrl("//example.org/meeting"), "https://example.org/meeting");
});

test("supports explicit intranet URLs and domain names with a port", () => {
  assert.equal(getMeetingUrl("http://intranet/meeting"), "http://intranet/meeting");
  assert.equal(getMeetingUrl("localhost:3000/meeting"), "https://localhost:3000/meeting");
  assert.equal(getMeetingUrl("example.org:8443/meeting"), "https://example.org:8443/meeting");
});

test("rejects invalid text, non-web protocols, and embedded credentials", () => {
  for (const value of [undefined, "", "not a URL", "not-a-url", "<script>alert(1)</script>", "javascript:alert(1)", "data:text/html,test", "ftp://example.org/file", "https://user:secret@example.org"]) {
    assert.equal(getMeetingUrl(value), "", String(value));
  }
});
