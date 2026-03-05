export type Venue = "Sportplatz" | "MZH" | "Turnhalle" | "Tanzraum";

export interface Team {
  id: string;
  name: string;
  sport: string;
}

export interface SportGroup {
  sport: string;
  teams: Team[];
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  date: Date;
  endDate: Date;
  venue: Venue;
  teamId: string;
  sport: string;
  teamName: string;
  sourceUrlHash?: string;
  updatedAtIso?: string;
  verification?: EventVerification;
  sourceType?: "calendar" | "shadow";
}

export type CalendarView = "day" | "week" | "month";
export type CalendarMode = "standard" | "plan";

export interface CalendarEventJson {
  id: string;
  title: string;
  description?: string;
  startIso: string;
  endIso: string;
  venue: Venue;
  teamId: string;
  sport: string;
  teamName: string;
  sourceUrlHash?: string;
  updatedAtIso?: string;
  verification?: EventVerification;
  sourceType?: "calendar" | "shadow";
}

export interface EventVerification {
  status:
    | "verified"
    | "time-conflict"
    | "missing-in-operator-plan"
    | "missing-in-team-calendar"
    | "ambiguous";
  matchedSlots: number;
  conflictSlots: number;
  note?: string;
}
