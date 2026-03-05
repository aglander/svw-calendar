import { CalendarEvent } from "@/types/calendar";

type EventType = "svw" | "schule" | "extern" | "unknown" | "gesperrt";

type EventColorSet = {
  bg: string;
  border: string;
  dot: string;
  text: string;
  backgroundColor: string;
  borderColor: string;
  dotColor: string;
};

const COLORS: Record<EventType, EventColorSet> = {
  svw: {
    bg: "",
    border: "",
    dot: "",
    text: "text-emerald-700 dark:text-emerald-300",
    backgroundColor: "rgba(16, 185, 129, 0.20)",
    borderColor: "#10b981",
    dotColor: "#10b981",
  },
  schule: {
    bg: "",
    border: "",
    dot: "",
    text: "text-sky-700 dark:text-sky-300",
    backgroundColor: "rgba(59, 130, 246, 0.24)",
    borderColor: "#3b82f6",
    dotColor: "#3b82f6",
  },
  extern: {
    bg: "",
    border: "",
    dot: "",
    text: "text-amber-700 dark:text-amber-300",
    backgroundColor: "rgba(245, 158, 11, 0.28)",
    borderColor: "#f59e0b",
    dotColor: "#f59e0b",
  },
  unknown: {
    bg: "",
    border: "",
    dot: "",
    text: "text-slate-700 dark:text-slate-300",
    backgroundColor: "rgba(100, 116, 139, 0.18)",
    borderColor: "#64748b",
    dotColor: "#64748b",
  },
  gesperrt: {
    bg: "",
    border: "",
    dot: "",
    text: "text-slate-700 dark:text-slate-200",
    backgroundColor: "rgba(107, 114, 128, 0.30)",
    borderColor: "#6b7280",
    dotColor: "#6b7280",
  },
};

export function getEventType(event: CalendarEvent): EventType {
  if (event.bookingType === "svw") return "svw";
  if (event.bookingType === "schule") return "schule";
  if (event.bookingType === "extern") return "extern";
  if (event.bookingType === "gesperrt") return "gesperrt";
  if (event.sourceType === "calendar") return "svw";
  const sport = String(event.sport || "").toLowerCase();
  if (sport === "schule") return "schule";
  if (sport === "extern") return "extern";
  return "unknown";
}

export function getEventColorSet(event: CalendarEvent): EventColorSet {
  return COLORS[getEventType(event)] || COLORS.unknown;
}
