import { useMemo, useState } from "react";
import { useCalendar } from "@/context/CalendarContext";
import { CalendarEvent, Venue } from "@/types/calendar";
import {
  addWeeks,
  eachDayOfInterval,
  endOfWeek,
  format,
  isSameDay,
  startOfWeek,
} from "date-fns";
import { de } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getEventColorSet } from "@/lib/eventColors";

const HOUR_START = 7;
const HOUR_END = 22;
const HOUR_HEIGHT = 52;

const venues: Venue[] = ["Sportplatz", "MZH", "Turnhalle", "Tanzraum"];

function getFieldOrder(event: CalendarEvent): number {
  const match = /\(Feld\s*(\d+)\)/i.exec(event.title);
  if (!match) return 99;
  const fieldNumber = Number(match[1]);
  return Number.isFinite(fieldNumber) ? fieldNumber : 99;
}

function layoutEvents(events: CalendarEvent[]): (CalendarEvent & { col: number; totalCols: number })[] {
  if (events.length === 0) return [];

  const sorted = [...events].sort((a, b) => {
    const byStart = a.date.getTime() - b.date.getTime();
    if (byStart !== 0) return byStart;

    const byField = getFieldOrder(a) - getFieldOrder(b);
    if (byField !== 0) return byField;

    const byEnd = a.endDate.getTime() - b.endDate.getTime();
    if (byEnd !== 0) return byEnd;

    return a.title.localeCompare(b.title, "de");
  });

  const getFixedFieldColumn = (event: CalendarEvent): number | null => {
    if (event.sourceType !== "shadow") return null;
    if (event.venue !== "MZH" && event.venue !== "Sportplatz") return null;

    const match = /\(Feld\s*(\d+)\)/i.exec(event.title);
    if (!match) return null;

    const field = Number(match[1]);
    if (field === 1) return 0;
    if (field === 2) return 1;
    return null;
  };

  const fixedFieldEvents: (CalendarEvent & { col: number; totalCols: number })[] = [];
  const regularEvents: CalendarEvent[] = [];

  sorted.forEach((event) => {
    const fixedCol = getFixedFieldColumn(event);
    if (fixedCol !== null) {
      fixedFieldEvents.push({ ...event, col: fixedCol, totalCols: 2 });
    } else {
      regularEvents.push(event);
    }
  });

  if (regularEvents.length === 0) {
    return fixedFieldEvents;
  }

  const columns: CalendarEvent[][] = [];
  for (const event of regularEvents) {
    let placed = false;
    for (let c = 0; c < columns.length; c++) {
      const lastInCol = columns[c][columns[c].length - 1];
      if (lastInCol.endDate.getTime() <= event.date.getTime()) {
        columns[c].push(event);
        placed = true;
        break;
      }
    }
    if (!placed) {
      columns.push([event]);
    }
  }

  const totalCols = columns.length;
  const result: (CalendarEvent & { col: number; totalCols: number })[] = [];
  columns.forEach((col, colIndex) => {
    col.forEach((event) => result.push({ ...event, col: colIndex, totalCols }));
  });
  return [...result, ...fixedFieldEvents];
}

function getEventStyle(event: CalendarEvent & { col: number; totalCols: number }) {
  const startMinutes = event.date.getHours() * 60 + event.date.getMinutes();
  const endMinutes = event.endDate.getHours() * 60 + event.endDate.getMinutes();
  const top = ((startMinutes - HOUR_START * 60) / 60) * HOUR_HEIGHT;
  const rawHeight = ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT;
  const verticalGapPx = 2;
  const height = Math.max(rawHeight - verticalGapPx, 22);
  const widthPercent = 100 / event.totalCols;
  const leftPercent = widthPercent * event.col;

  return {
    top: `${top + 1}px`,
    height: `${height}px`,
    left: `calc(${leftPercent}% + 1px)`,
    width: `calc(${widthPercent}% - 2px)`,
  };
}

export function WeekView() {
  const { currentDate, setCurrentDate, effectiveEvents, mode, activeTeamIds } = useCalendar();
  const [selectedVenue, setSelectedVenue] = useState<Venue>("Sportplatz");

  const weekStart = startOfWeek(currentDate, { locale: de });
  const weekEnd = endOfWeek(currentDate, { locale: de });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const hours = useMemo(
    () => Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i),
    []
  );

  const baseEvents =
    mode === "standard"
      ? effectiveEvents.filter((event) => activeTeamIds.has(event.teamId))
      : effectiveEvents;
  const eventsForVenue = baseEvents.filter((event) => event.venue === selectedVenue);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">
            {format(weekStart, "d. MMM", { locale: de })} - {format(weekEnd, "d. MMM yyyy", { locale: de })}
          </h2>
          <p className="text-sm text-muted-foreground">{selectedVenue}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addWeeks(currentDate, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="text-xs" onClick={() => setCurrentDate(new Date())}>
            Heute
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addWeeks(currentDate, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {venues.map((venue) => (
          <button
            key={venue}
            onClick={() => setSelectedVenue(venue)}
            className={cn(
              "px-2.5 py-1 text-xs rounded-md border transition-colors",
              selectedVenue === venue
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:text-foreground"
            )}
          >
            {venue}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-border overflow-x-auto">
        <div className="min-w-[980px]">
          <div className="grid" style={{ gridTemplateColumns: "56px repeat(7, minmax(120px, 1fr))" }}>
            <div className="border-b border-r border-border bg-muted/40" />
            {days.map((day) => (
              <div key={day.toISOString()} className="border-b border-r border-border bg-muted/40 p-2">
                <p className="text-xs text-muted-foreground">{format(day, "EEE", { locale: de })}</p>
                <p className="text-sm font-semibold text-foreground">{format(day, "d. M.")}</p>
              </div>
            ))}
          </div>

          <div className="grid" style={{ gridTemplateColumns: "56px repeat(7, minmax(120px, 1fr))" }}>
            <div className="border-r border-border">
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="text-[10px] text-muted-foreground text-right pr-2 border-b border-border/50"
                  style={{ height: `${HOUR_HEIGHT}px` }}
                >
                  {`${hour.toString().padStart(2, "0")}:00`}
                </div>
              ))}
            </div>

            {days.map((day) => {
              const dayEvents = eventsForVenue.filter((event) => isSameDay(event.date, day));
              const laid = layoutEvents(dayEvents);
              return (
                <div
                  key={day.toISOString()}
                  className="relative border-r border-border"
                  style={{ height: `${(HOUR_END - HOUR_START) * HOUR_HEIGHT}px` }}
                >
                  {hours.map((hour) => (
                    <div
                      key={hour}
                      className="border-b border-border/50"
                      style={{ height: `${HOUR_HEIGHT}px` }}
                    />
                  ))}

                  {laid.map((event) => {
                    const style = getEventStyle(event);
                    const colors = getEventColorSet(event);
                    return (
                      <div
                        key={event.id}
                        className={cn(
                          "absolute rounded-md border-l-3 px-1.5 py-1 overflow-hidden",
                          colors.bg,
                          colors.border
                        )}
                        style={{
                          ...style,
                          backgroundColor: colors.backgroundColor,
                          borderLeftColor: colors.borderColor,
                        }}
                      >
                        <p className="text-[11px] font-semibold text-card-foreground truncate leading-tight">
                          {event.title}
                        </p>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Clock className="h-2.5 w-2.5" />
                          {format(event.date, "HH:mm")} - {format(event.endDate, "HH:mm")}
                        </p>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
