import assert from "node:assert/strict";
import test from "node:test";
import { getMeetingEndTimestamp, hasMeetingEnded } from "../src/utils/meetingTime";

test("closes at the meeting's end time in Thailand, rather than its start time", () => {
  const endsAt = getMeetingEndTimestamp({ date: "2026-10-29", end_time: "12:00" });
  assert.equal(endsAt, Date.parse("2026-10-29T05:00:00Z"));
  assert.equal(hasMeetingEnded(endsAt, Date.parse("2026-10-29T04:59:59.999Z")), false);
  assert.equal(hasMeetingEnded(endsAt, Date.parse("2026-10-29T05:00:00Z")), true);
  assert.equal(hasMeetingEnded(endsAt, Date.parse("2026-10-30T00:00:00Z")), true);
});

test("keeps multi-day meetings available through their final day", () => {
  const endsAt = getMeetingEndTimestamp({ date: "2026-10-29", end_date: "2026-10-31", end_time: "" });
  assert.equal(endsAt, Date.parse("2026-11-01T00:00:00+07:00"));
  assert.equal(hasMeetingEnded(endsAt, Date.parse("2026-10-31T23:59:59.999+07:00")), false);
  assert.equal(hasMeetingEnded(endsAt, Date.parse("2026-11-01T00:00:00+07:00")), true);
});

test("uses the last date and recorded end time for multi-day legacy records", () => {
  assert.equal(
    getMeetingEndTimestamp({ date: "2026-10-29", end_date: "2026-10-31", end_time: "16:30:15" }),
    Date.parse("2026-10-31T16:30:15+07:00"),
  );
});

test("single-day meetings without a time expire at the next Thai midnight", () => {
  assert.equal(getMeetingEndTimestamp({ date: "2026-12-31", end_time: "" }), Date.parse("2027-01-01T00:00:00+07:00"));
});

test("rejects missing, impossible or reversed end dates and invalid end times", () => {
  for (const meeting of [
    { date: "", end_time: "12:00" },
    { date: "2026-02-30", end_time: "12:00" },
    { date: "2026-10-29", end_date: "2026-10-28", end_time: "12:00" },
    { date: "2026-10-29", end_time: "24:00" },
    { date: "2026-10-29", end_time: "12:60" },
  ]) assert.equal(getMeetingEndTimestamp(meeting), null);
});
