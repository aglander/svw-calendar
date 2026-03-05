import { describe, expect, it } from "vitest";
import {
  DEFAULT_EVENT_DURATION_MINUTES,
  normalizeFeedUrl,
  normalizeSourceEvents,
} from "../../scripts/import-calendars.mjs";

const source = {
  teamId: "fb-1m",
  teamName: "1. Männer",
  sport: "Fußball",
  url: "webcal://example.com/calendar.ics",
  enabled: true,
  timezone: "Europe/Berlin",
  venueDefault: "Sportplatz",
};

describe("import-calendars", () => {
  it("normalizes webcal URLs", () => {
    expect(normalizeFeedUrl("webcal://example.com/a.ics")).toBe("https://example.com/a.ics");
    expect(normalizeFeedUrl("https://example.com/a.ics")).toBe("https://example.com/a.ics");
  });

  it("uses fallback duration when DTEND is missing", () => {
    const now = new Date("2026-03-03T10:00:00.000Z");
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:test-1",
      "DTSTART:20260303T180000",
      "SUMMARY:Training",
      "LOCATION:Sportplatz",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const [event] = normalizeSourceEvents(ics, source, now);
    expect(event).toBeDefined();

    const start = new Date(event.startIso).getTime();
    const end = new Date(event.endIso).getTime();
    const durationMinutes = Math.round((end - start) / 1000 / 60);

    expect(durationMinutes).toBe(DEFAULT_EVENT_DURATION_MINUTES);
  });

  it("deduplicates repeated event entries by stable id upstream", () => {
    const now = new Date("2026-03-03T10:00:00.000Z");
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:dup-1",
      "DTSTART:20260303T180000",
      "DTEND:20260303T193000",
      "SUMMARY:Spiel",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:dup-1",
      "DTSTART:20260303T180000",
      "DTEND:20260303T193000",
      "SUMMARY:Spiel",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const events = normalizeSourceEvents(ics, source, now);
    const uniqueIds = new Set(events.map((event) => event.id));

    expect(events).toHaveLength(2);
    expect(uniqueIds.size).toBe(1);
  });

  it("ignores malformed events and keeps valid ones", () => {
    const now = new Date("2026-03-03T10:00:00.000Z");
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:broken",
      "SUMMARY:Invalid without DTSTART",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:valid-1",
      "DTSTART:20260305T180000",
      "DTEND:20260305T193000",
      "SUMMARY:Valid",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const events = normalizeSourceEvents(ics, source, now);

    expect(events).toHaveLength(1);
    expect(events[0].title).toBe("Valid");
  });
});
