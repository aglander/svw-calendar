export type Venue = "Sportplatz" | "MZH" | "Turnhalle";

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
}

export type CalendarView = "day" | "week" | "month";
