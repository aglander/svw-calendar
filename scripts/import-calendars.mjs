import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

const CONFIG_PATH = path.join(ROOT_DIR, "config", "calendar-sources.public.json");
const EVENTS_OUT_PATH = path.join(ROOT_DIR, "public", "data", "events.json");
const SYNC_OUT_PATH = path.join(ROOT_DIR, "public", "data", "last-sync.json");
const SHADOW_SLOTS_PATH = path.join(ROOT_DIR, "public", "data", "shadow-slots.json");

const REQUEST_TIMEOUT_MS = 10_000;
const RETRIES = 2;
const WINDOW_PAST_DAYS = 30;
const WINDOW_FUTURE_DAYS = 365;
const DEFAULT_EVENT_DURATION_MINUTES = 90;

const VENUES = ["Sportplatz", "MZH", "Turnhalle", "Tanzraum"];
const BERLIN_TIMEZONE = "Europe/Berlin";

function sha(value) {
  return createHash("sha256").update(value).digest("hex");
}

function unescapeIcsText(value) {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

function normalizeFeedUrl(url) {
  if (!url || typeof url !== "string") {
    return "";
  }

  const trimmed = url.trim();
  if (trimmed.toLowerCase().startsWith("webcal://")) {
    return `https://${trimmed.slice("webcal://".length)}`;
  }

  return trimmed;
}

function unfoldIcsLines(icalText) {
  const lines = icalText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const unfolded = [];

  for (const line of lines) {
    if (line.startsWith(" ") || line.startsWith("\t")) {
      if (unfolded.length === 0) {
        unfolded.push(line.trimStart());
      } else {
        unfolded[unfolded.length - 1] += line.slice(1);
      }
      continue;
    }

    unfolded.push(line);
  }

  return unfolded;
}

function parsePropertyLine(line) {
  const separator = line.indexOf(":");
  if (separator === -1) return null;

  const keyPart = line.slice(0, separator);
  const value = line.slice(separator + 1);
  const [propertyNameRaw, ...parameterParts] = keyPart.split(";");
  const propertyName = propertyNameRaw.toUpperCase();

  const parameters = {};
  for (const parameterPart of parameterParts) {
    const [rawKey, ...rawValueParts] = parameterPart.split("=");
    if (!rawKey || rawValueParts.length === 0) continue;
    parameters[rawKey.toUpperCase()] = rawValueParts.join("=");
  }

  return { propertyName, parameters, value };
}

function parseIcsDate(value, parameters = {}) {
  if (!value) return null;

  const cleaned = value.trim();
  const isDateOnly = parameters.VALUE === "DATE" || /^\d{8}$/.test(cleaned);

  if (isDateOnly) {
    const year = Number(cleaned.slice(0, 4));
    const month = Number(cleaned.slice(4, 6)) - 1;
    const day = Number(cleaned.slice(6, 8));

    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
      return null;
    }

    return { date: new Date(year, month, day, 0, 0, 0, 0), allDay: true };
  }

  const zulu = cleaned.endsWith("Z");
  const raw = zulu ? cleaned.slice(0, -1) : cleaned;
  const parts = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?$/);
  if (!parts) return null;

  const [, y, mo, d, h, mi, s = "00"] = parts;
  const year = Number(y);
  const month = Number(mo) - 1;
  const day = Number(d);
  const hour = Number(h);
  const minute = Number(mi);
  const second = Number(s);

  if (
    ![year, month, day, hour, minute, second].every((part) => Number.isFinite(part))
  ) {
    return null;
  }

  const date = zulu
    ? new Date(Date.UTC(year, month, day, hour, minute, second, 0))
    : new Date(year, month, day, hour, minute, second, 0);

  return { date, allDay: false };
}

function parseIcsEvents(icalText) {
  const lines = unfoldIcsLines(icalText);
  const events = [];
  let currentEvent = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      currentEvent = {};
      continue;
    }

    if (line === "END:VEVENT") {
      if (currentEvent) {
        events.push(currentEvent);
      }
      currentEvent = null;
      continue;
    }

    if (!currentEvent) continue;

    const parsed = parsePropertyLine(line);
    if (!parsed) continue;

    const { propertyName, parameters, value } = parsed;

    switch (propertyName) {
      case "UID":
        currentEvent.uid = value.trim();
        break;
      case "SUMMARY":
        currentEvent.summary = unescapeIcsText(value);
        break;
      case "DESCRIPTION":
        currentEvent.description = unescapeIcsText(value);
        break;
      case "LOCATION":
        currentEvent.location = unescapeIcsText(value);
        break;
      case "DTSTART":
        currentEvent.dtstart = parseIcsDate(value, parameters);
        break;
      case "DTEND":
        currentEvent.dtend = parseIcsDate(value, parameters);
        break;
      case "LAST-MODIFIED":
      case "DTSTAMP": {
        const parsedDate = parseIcsDate(value, parameters);
        if (parsedDate?.date) {
          currentEvent.lastModified = parsedDate.date;
        }
        break;
      }
      default:
        break;
    }
  }

  return events;
}

function inferVenue(location, venueDefault = "Sportplatz") {
  if (!location) {
    return VENUES.includes(venueDefault) ? venueDefault : "Sportplatz";
  }

  const normalized = location.toLowerCase();

  if (normalized.includes("mzh") || normalized.includes("mehrzweck")) {
    return "MZH";
  }

  if (normalized.includes("turnhalle") || normalized.includes("halle")) {
    return "Turnhalle";
  }

  if (normalized.includes("tanzraum")) {
    return "Tanzraum";
  }

  if (
    normalized.includes("sportplatz") ||
    normalized.includes("sportanlage") ||
    normalized.includes("platz") ||
    normalized.includes("stadion")
  ) {
    return "Sportplatz";
  }

  return VENUES.includes(venueDefault) ? venueDefault : "Sportplatz";
}

function buildStableId(source, rawEvent, startIso, summary) {
  const base = `${source.teamId}|${rawEvent.uid || "no-uid"}|${startIso}|${summary}`;
  return `evt-${sha(base).slice(0, 16)}`;
}

function normalizeRawEvent(rawEvent, source, generatedAtIso) {
  if (!rawEvent.dtstart?.date) return null;

  const start = rawEvent.dtstart.date;
  const isAllDay = rawEvent.dtstart.allDay;
  let end = rawEvent.dtend?.date ?? null;

  if (!end) {
    if (isAllDay) {
      end = new Date(start);
      end.setDate(end.getDate() + 1);
    } else {
      end = new Date(start);
      end.setMinutes(end.getMinutes() + DEFAULT_EVENT_DURATION_MINUTES);
    }
  }

  if (end.getTime() <= start.getTime()) {
    end = new Date(start);
    end.setMinutes(end.getMinutes() + 60);
  }

  const summary = rawEvent.summary || `${source.teamName} Termin`;
  const startIso = start.toISOString();
  const stableId = buildStableId(source, rawEvent, startIso, summary);

  return {
    id: stableId,
    title: summary,
    description: rawEvent.description || undefined,
    startIso,
    endIso: end.toISOString(),
    venue: inferVenue(rawEvent.location, source.venueDefault),
    teamId: source.teamId,
    sport: source.sport,
    teamName: source.teamName,
    sourceType: "calendar",
    bookingType: "svw",
    sourceUrlHash: sha(normalizeFeedUrl(source.url)).slice(0, 16),
    updatedAtIso: (rawEvent.lastModified || new Date(generatedAtIso)).toISOString(),
  };
}

function getWindow(generatedAt = new Date()) {
  const start = new Date(generatedAt);
  start.setDate(start.getDate() - WINDOW_PAST_DAYS);
  start.setHours(0, 0, 0, 0);

  const end = new Date(generatedAt);
  end.setDate(end.getDate() + WINDOW_FUTURE_DAYS);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function normalizeSourceEvents(icalText, source, generatedAt = new Date()) {
  const generatedAtIso = generatedAt.toISOString();
  const rawEvents = parseIcsEvents(icalText);
  const { start: windowStart, end: windowEnd } = getWindow(generatedAt);

  const normalized = [];
  for (const rawEvent of rawEvents) {
    const normalizedEvent = normalizeRawEvent(rawEvent, source, generatedAtIso);
    if (!normalizedEvent) continue;

    const startTime = new Date(normalizedEvent.startIso).getTime();
    if (startTime < windowStart.getTime() || startTime > windowEnd.getTime()) {
      continue;
    }

    normalized.push(normalizedEvent);
  }

  return normalized;
}

function parseTimeToMinutes(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value || "");
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function normalizeSportName(sport) {
  const value = String(sport || "").toLowerCase();
  if (value.includes("fußball") || value.includes("fussball")) return "fußball";
  if (value.includes("basketball")) return "basketball";
  if (value.includes("tischtennis")) return "tischtennis";
  if (value.includes("volleyball")) return "volleyball";
  if (value.includes("badminton")) return "badminton";
  if (value.includes("discodance")) return "discodance";
  if (value.includes("showdance")) return "showdance";
  if (value.includes("tanzen")) return "tanzen";
  if (value.includes("geräteturnen") || value.includes("geraeteturnen")) return "geräteturnen";
  if (value.includes("gymnastik")) return "gymnastik";
  return value || "unknown";
}

function getEventLocalTimeInfo(eventStartIso) {
  const date = new Date(eventStartIso);
  const formatter = new Intl.DateTimeFormat("de-DE", {
    timeZone: BERLIN_TIMEZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);
  const weekdayRaw = parts.find((part) => part.type === "weekday")?.value || "";
  const hour = parts.find((part) => part.type === "hour")?.value || "00";
  const minute = parts.find((part) => part.type === "minute")?.value || "00";
  const weekday = weekdayRaw.replace(".", "");
  const dayOfWeekMap = { Mo: 1, Di: 2, Mi: 3, Do: 4, Fr: 5, Sa: 6, So: 7 };

  return {
    dayOfWeek: dayOfWeekMap[weekday] ?? null,
    startMinutes: Number(hour) * 60 + Number(minute),
  };
}

function getExpectedShadowSports(event) {
  const expected = new Set();
  expected.add(normalizeSportName(event.sport));

  if (event.teamId.startsWith("fb-")) expected.add("fußball");
  if (event.teamId.startsWith("bb-")) expected.add("basketball");
  if (event.teamId.startsWith("tt-")) expected.add("tischtennis");
  if (event.teamId.includes("badm")) expected.add("badminton");
  if (event.teamId.includes("disco")) expected.add("discodance");
  if (event.teamId.includes("showdance")) expected.add("showdance");
  if (event.teamId.includes("tanzen")) expected.add("tanzen");
  if (event.teamId.includes("gym")) expected.add("gymnastik");
  if (event.teamId.includes("turnen")) expected.add("geräteturnen");
  if (event.teamId.includes("volleyball") || event.teamId.startsWith("sport-Volleyball")) {
    expected.add("volleyball");
  }

  return expected;
}

async function loadShadowSlots() {
  try {
    const raw = await readFile(SHADOW_SLOTS_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((slot) => slot && slot.ownerType === "svw")
      .map((slot) => ({
        venue: VENUES.includes(slot.venue) ? slot.venue : null,
        dayOfWeek: Number(slot.dayOfWeek),
        startMinutes: parseTimeToMinutes(String(slot.start || "")),
        endMinutes: parseTimeToMinutes(String(slot.end || "")),
        sport: normalizeSportName(slot.svwSport || ""),
      }))
      .filter(
        (slot) =>
          slot.venue &&
          Number.isFinite(slot.dayOfWeek) &&
          Number.isFinite(slot.startMinutes) &&
          Number.isFinite(slot.endMinutes) &&
          slot.endMinutes > slot.startMinutes
      );
  } catch {
    return [];
  }
}

function addVerification(events, shadowSlots) {
  if (!shadowSlots.length) {
    return events.map((event) => ({
      ...event,
      verification: {
        status: "missing-in-operator-plan",
        matchedSlots: 0,
        conflictSlots: 0,
        note: "Keine Schattendaten vorhanden",
      },
    }));
  }

  return events.map((event) => {
    const local = getEventLocalTimeInfo(event.startIso);
    const endLocal = getEventLocalTimeInfo(event.endIso);
    const endMinutes = endLocal.startMinutes;

    if (!local.dayOfWeek || !Number.isFinite(endMinutes)) {
      return {
        ...event,
        verification: {
          status: "ambiguous",
          matchedSlots: 0,
          conflictSlots: 0,
          note: "Zeit konnte nicht eindeutig bestimmt werden",
        },
      };
    }

    const overlapping = shadowSlots.filter((slot) => {
      if (slot.dayOfWeek !== local.dayOfWeek) return false;
      if (slot.venue !== event.venue) return false;
      return local.startMinutes < slot.endMinutes && endMinutes > slot.startMinutes;
    });

    if (!overlapping.length) {
      return {
        ...event,
        verification: {
          status: "missing-in-operator-plan",
          matchedSlots: 0,
          conflictSlots: 0,
        },
      };
    }

    const expectedSports = getExpectedShadowSports(event);
    const matching = overlapping.filter((slot) => expectedSports.has(slot.sport));
    const conflicts = overlapping.filter((slot) => !expectedSports.has(slot.sport));

    if (matching.length > 0 && conflicts.length === 0) {
      return {
        ...event,
        verification: {
          status: "verified",
          matchedSlots: matching.length,
          conflictSlots: 0,
        },
      };
    }

    if (matching.length > 0 && conflicts.length > 0) {
      return {
        ...event,
        verification: {
          status: "ambiguous",
          matchedSlots: matching.length,
          conflictSlots: conflicts.length,
          note: "Parallele Fremdbelegung im gleichen Zeitfenster",
        },
      };
    }

    return {
      ...event,
      verification: {
        status: "time-conflict",
        matchedSlots: 0,
        conflictSlots: conflicts.length,
      },
    };
  });
}

async function fetchWithRetry(url, retries = RETRIES, timeoutMs = REQUEST_TIMEOUT_MS) {
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "svw-calendar-importer/1.0" },
        redirect: "follow",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt === retries) {
        throw lastError;
      }
      await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError;
}

async function loadSources() {
  const raw = await readFile(CONFIG_PATH, "utf8");
  const parsed = JSON.parse(raw);

  if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.sources)) {
    throw new Error("Ungültige config/calendar-sources.public.json: expected version=1 and sources[]");
  }

  return parsed.sources
    .map((source) => ({
      teamId: String(source.teamId || ""),
      teamName: String(source.teamName || ""),
      sport: String(source.sport || ""),
      url: String(source.url || ""),
      enabled: Boolean(source.enabled),
      timezone: source.timezone ? String(source.timezone) : "Europe/Berlin",
      venueDefault: source.venueDefault ? String(source.venueDefault) : "Sportplatz",
    }))
    .filter((source) => source.teamId && source.teamName && source.sport)
    .sort((a, b) => a.teamId.localeCompare(b.teamId));
}

async function writeOutputs(events, syncInfo) {
  await mkdir(path.dirname(EVENTS_OUT_PATH), { recursive: true });
  await writeFile(EVENTS_OUT_PATH, `${JSON.stringify(events, null, 2)}\n`, "utf8");
  await writeFile(SYNC_OUT_PATH, `${JSON.stringify(syncInfo, null, 2)}\n`, "utf8");
}

async function runImport() {
  const generatedAt = new Date();
  const generatedAtIso = generatedAt.toISOString();
  const sources = await loadSources();
  const shadowSlots = await loadShadowSlots();

  const errors = [];
  const allEvents = [];

  for (const source of sources) {
    if (!source.enabled) continue;

    const normalizedUrl = normalizeFeedUrl(source.url);
    if (!normalizedUrl) {
      errors.push({
        teamId: source.teamId,
        error: "Source enabled but URL is empty",
      });
      continue;
    }

    try {
      const icalText = await fetchWithRetry(normalizedUrl);
      const events = normalizeSourceEvents(icalText, source, generatedAt);
      allEvents.push(...events);
    } catch (error) {
      errors.push({
        teamId: source.teamId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const deduped = Array.from(new Map(allEvents.map((event) => [event.id, event])).values()).sort(
    (a, b) => a.startIso.localeCompare(b.startIso) || a.id.localeCompare(b.id)
  );
  const withVerification = addVerification(deduped, shadowSlots);

  const syncInfo = {
    generatedAtIso,
    sourceCount: sources.length,
    activeSourceCount: sources.filter((source) => source.enabled).length,
    eventCount: withVerification.length,
    shadowSlotCount: shadowSlots.length,
    errorCount: errors.length,
    errors,
  };

  await writeOutputs(withVerification, syncInfo);

  console.log(
    `Import abgeschlossen: ${withVerification.length} Events aus ${syncInfo.activeSourceCount} aktiven Quellen (${errors.length} Fehler)`
  );
}

if (process.argv[1] === __filename) {
  runImport().catch((error) => {
    console.error("Kalender-Import fehlgeschlagen:", error);
    process.exitCode = 1;
  });
}

export {
  DEFAULT_EVENT_DURATION_MINUTES,
  normalizeFeedUrl,
  parseIcsEvents,
  parseIcsDate,
  normalizeSourceEvents,
  normalizeRawEvent,
  inferVenue,
};
