import React, { createContext, useContext, useState, useMemo, useEffect } from "react";
import {
  CalendarEvent,
  CalendarEventJson,
  CalendarMode,
  CalendarView,
  Venue,
} from "@/types/calendar";
import { generateMockEvents, getAllTeamIds } from "@/data/calendarData";
import { addDays, endOfMonth, getISODay, startOfMonth } from "date-fns";

interface ShadowSlotJson {
  venue: string;
  dayOfWeek: number;
  start: string;
  end: string;
  owner: string;
  ownerType: "svw" | "schule" | "extern" | "unknown";
  svwSport?: string | null;
  field?: string | null;
  fields?: string[];
  fieldCount?: number;
}

interface CalendarContextType {
  events: CalendarEvent[];
  shadowEvents: CalendarEvent[];
  filteredEvents: CalendarEvent[];
  effectiveEvents: CalendarEvent[];
  isLoading: boolean;
  error: string | null;
  currentDate: Date;
  setCurrentDate: (d: Date) => void;
  view: CalendarView;
  setView: (v: CalendarView) => void;
  mode: CalendarMode;
  setMode: (m: CalendarMode) => void;
  activeTeamIds: Set<string>;
  toggleTeam: (id: string) => void;
  toggleSport: (sport: string, teamIds: string[]) => void;
  isSportActive: (teamIds: string[]) => boolean;
  activeVenues: Set<Venue>;
  toggleVenue: (v: Venue) => void;
}

const CalendarContext = createContext<CalendarContextType | null>(null);

function parseEventJson(event: CalendarEventJson): CalendarEvent {
  const venue: Venue =
    event.venue === "MZH" ||
    event.venue === "Turnhalle" ||
    event.venue === "Sportplatz" ||
    event.venue === "Tanzraum"
      ? event.venue
      : "Sportplatz";

  return {
    id: event.id,
    title: event.title,
    description: event.description,
    date: new Date(event.startIso),
    endDate: new Date(event.endIso),
    venue,
    teamId: event.teamId,
    sport: event.sport,
    teamName: event.teamName,
    sourceUrlHash: event.sourceUrlHash,
    updatedAtIso: event.updatedAtIso,
    verification: event.verification,
    sourceType: event.sourceType || "calendar",
    bookingType: event.bookingType || "svw",
    fieldColumn: event.fieldColumn,
    fieldSpan: event.fieldSpan,
  };
}

function parseShadowVenue(venue: string): Venue {
  if (venue === "MZH" || venue === "Turnhalle" || venue === "Sportplatz" || venue === "Tanzraum") {
    return venue;
  }
  return "Sportplatz";
}

function parseTimeToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function toFieldColumn(value?: string | null): 1 | 2 | undefined {
  if (!value) return undefined;
  const match = /feld\s*(\d+)/i.exec(value);
  if (!match) return undefined;
  if (match[1] === "1") return 1;
  if (match[1] === "2") return 2;
  return undefined;
}

export function CalendarProvider({ children }: { children: React.ReactNode }) {
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [shadowSlots, setShadowSlots] = useState<ShadowSlotJson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [view, setView] = useState<CalendarView>("day");
  const [mode, setMode] = useState<CalendarMode>("standard");
  const [activeTeamIds, setActiveTeamIds] = useState(() => new Set(getAllTeamIds()));
  const [activeVenues, setActiveVenues] = useState<Set<Venue>>(
    () => new Set(["Sportplatz", "MZH", "Turnhalle", "Tanzraum"])
  );

  useEffect(() => {
    let cancelled = false;

    const loadEvents = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/data/events.json", { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = (await response.json()) as CalendarEventJson[];
        if (!Array.isArray(payload)) {
          throw new Error("events.json must contain an array");
        }

        const parsed = payload
          .map(parseEventJson)
          .filter((event) => !Number.isNaN(event.date.getTime()) && !Number.isNaN(event.endDate.getTime()))
          .sort((a, b) => a.date.getTime() - b.date.getTime());

        if (!cancelled) {
          setCalendarEvents(parsed);
        }
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : String(loadError);
        if (!cancelled) {
          if (import.meta.env.DEV) {
            setCalendarEvents(generateMockEvents());
            setError(`Kalenderdaten konnten nicht geladen werden (${message}); Mock-Daten aktiv.`);
          } else {
            setCalendarEvents([]);
            setError(`Kalenderdaten konnten nicht geladen werden (${message}).`);
          }
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadEvents();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadShadowSlots = async () => {
      try {
        const response = await fetch("/data/shadow-slots.json", { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const payload = (await response.json()) as ShadowSlotJson[];
        if (!Array.isArray(payload)) {
          throw new Error("shadow-slots.json must contain an array");
        }
        if (!cancelled) {
          setShadowSlots(payload);
        }
      } catch {
        if (!cancelled) {
          setShadowSlots([]);
        }
      }
    };

    loadShadowSlots();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", mode === "plan");
    return () => {
      document.documentElement.classList.remove("dark");
    };
  }, [mode]);

  const projectedShadowEvents = useMemo<CalendarEvent[]>(() => {
    if (shadowSlots.length === 0) return [];

    const from = startOfMonth(addDays(currentDate, -35));
    const to = endOfMonth(addDays(currentDate, 70));
    const days: Date[] = [];
    for (let d = new Date(from); d <= to; d = addDays(d, 1)) {
      days.push(new Date(d));
    }

    const events: CalendarEvent[] = [];
    shadowSlots.forEach((slot, slotIndex) => {
      const startMinutes = parseTimeToMinutes(String(slot.start || ""));
      const endMinutes = parseTimeToMinutes(String(slot.end || ""));
      if (
        !Number.isFinite(slot.dayOfWeek) ||
        startMinutes === null ||
        endMinutes === null ||
        endMinutes <= startMinutes
      ) {
        return;
      }

      const venue = parseShadowVenue(String(slot.venue || ""));
      const sport =
        slot.ownerType === "svw"
          ? slot.svwSport || "Verein"
          : slot.ownerType === "schule"
            ? "Schule"
            : slot.ownerType === "extern"
              ? "Extern"
              : "Unbekannt";
      const owner = String(slot.owner || "Belegung");
      const displayName = slot.ownerType === "extern" ? "Extern" : owner;
      const isTwoFieldVenue = venue === "MZH" || venue === "Sportplatz";
      const isFullPlaceSlot =
        isTwoFieldVenue &&
        Array.isArray(slot.fields) &&
        slot.fields.includes("Feld 1") &&
        slot.fields.includes("Feld 2");
      const showFieldSuffix = Boolean(slot.field) && isTwoFieldVenue && !isFullPlaceSlot;
      const field = showFieldSuffix ? ` (${slot.field})` : "";
      const teamId = `shadow-${slot.ownerType}-${slug(owner) || "owner"}`;

      days.forEach((day) => {
        if (getISODay(day) !== slot.dayOfWeek) return;
        const start = new Date(day);
        start.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);
        const end = new Date(day);
        end.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0);

        const idBase = `shadow-${slotIndex}-${day.toISOString().slice(0, 10)}-${teamId}`;
        const baseEvent = {
          title: `${displayName}${field}`,
          date: start,
          endDate: end,
          venue,
          sport,
          teamName: owner,
          sourceType: "shadow" as const,
          bookingType: slot.ownerType,
        };

        if (isFullPlaceSlot) {
          events.push({
            ...baseEvent,
            id: idBase,
            teamId,
            fieldSpan: 2,
          });
          return;
        }

        events.push({
          ...baseEvent,
          id: idBase,
          teamId,
          fieldColumn: toFieldColumn(slot.field),
        });
      });
    });

    // Weekly lock window in plan mode: Turnhalle every Sunday 13:00-15:00
    days.forEach((day) => {
      if (getISODay(day) !== 7) return;

      const start = new Date(day);
      start.setHours(13, 0, 0, 0);
      const end = new Date(day);
      end.setHours(15, 0, 0, 0);

      events.push({
        id: `shadow-gesperrt-turnhalle-${day.toISOString().slice(0, 10)}`,
        title: "Gesperrt",
        date: start,
        endDate: end,
        venue: "Turnhalle",
        teamId: "shadow-gesperrt-turnhalle",
        sport: "Sperrzeit",
        teamName: "Gesperrt",
        sourceType: "shadow",
        bookingType: "gesperrt",
      });
    });

    return events.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [shadowSlots, currentDate]);

  const effectiveEvents = useMemo(
    () => (mode === "plan" ? projectedShadowEvents : calendarEvents),
    [mode, projectedShadowEvents, calendarEvents]
  );

  const toggleTeam = (id: string) => {
    setActiveTeamIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSport = (sport: string, teamIds: string[]) => {
    setActiveTeamIds((prev) => {
      const next = new Set(prev);
      const allActive = teamIds.every((id) => next.has(id));
      teamIds.forEach((id) => {
        if (allActive) next.delete(id);
        else next.add(id);
      });
      return next;
    });
  };

  const isSportActive = (teamIds: string[]) => {
    return teamIds.every((id) => activeTeamIds.has(id));
  };

  const toggleVenue = (v: Venue) => {
    setActiveVenues((prev) => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return next;
    });
  };

  const filteredEvents = useMemo(() => {
    if (mode === "plan") {
      return effectiveEvents.filter((event) => activeVenues.has(event.venue));
    }

    return effectiveEvents.filter(
      (event) => activeTeamIds.has(event.teamId) && activeVenues.has(event.venue)
    );
  }, [mode, effectiveEvents, activeTeamIds, activeVenues]);

  return (
    <CalendarContext.Provider
      value={{
        events: calendarEvents,
        shadowEvents: projectedShadowEvents,
        filteredEvents,
        effectiveEvents,
        isLoading,
        error,
        currentDate,
        setCurrentDate,
        view,
        setView,
        mode,
        setMode,
        activeTeamIds,
        toggleTeam,
        toggleSport,
        isSportActive,
        activeVenues,
        toggleVenue,
      }}
    >
      {children}
    </CalendarContext.Provider>
  );
}

export function useCalendar() {
  const ctx = useContext(CalendarContext);
  if (!ctx) throw new Error("useCalendar must be used within CalendarProvider");
  return ctx;
}
