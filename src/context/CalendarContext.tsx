import React, { createContext, useContext, useState, useMemo } from "react";
import { CalendarEvent, CalendarView, Venue } from "@/types/calendar";
import { generateMockEvents, getAllTeamIds } from "@/data/calendarData";

interface CalendarContextType {
  events: CalendarEvent[];
  filteredEvents: CalendarEvent[];
  currentDate: Date;
  setCurrentDate: (d: Date) => void;
  view: CalendarView;
  setView: (v: CalendarView) => void;
  activeTeamIds: Set<string>;
  toggleTeam: (id: string) => void;
  toggleSport: (sport: string, teamIds: string[]) => void;
  isSportActive: (teamIds: string[]) => boolean;
  activeVenues: Set<Venue>;
  toggleVenue: (v: Venue) => void;
}

const CalendarContext = createContext<CalendarContextType | null>(null);

export function CalendarProvider({ children }: { children: React.ReactNode }) {
  const [events] = useState(() => generateMockEvents());
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [view, setView] = useState<CalendarView>("day");
  const [activeTeamIds, setActiveTeamIds] = useState(() => new Set(getAllTeamIds()));
  const [activeVenues, setActiveVenues] = useState<Set<Venue>>(
    () => new Set(["Sportplatz", "MZH", "Turnhalle"])
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
    return events.filter(
      (e) => activeTeamIds.has(e.teamId) && activeVenues.has(e.venue)
    );
  }, [events, activeTeamIds, activeVenues]);

  return (
    <CalendarContext.Provider
      value={{
        events,
        filteredEvents,
        currentDate,
        setCurrentDate,
        view,
        setView,
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
