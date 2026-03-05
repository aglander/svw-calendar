import { useCalendar } from "@/context/CalendarContext";
import { CalendarEvent, Venue } from "@/types/calendar";
import { addDays, format, isSameDay } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { sportIcons } from "@/lib/sportIcons";
import { Button } from "@/components/ui/button";

const HOUR_START = 7;
const HOUR_END = 22;
const HOUR_HEIGHT = 64; // px per hour

const venues: Venue[] = ["Sportplatz", "MZH", "Turnhalle", "Tanzraum"];

const venueColors: Record<Venue, { bg: string; border: string; text: string }> = {
  Sportplatz: {
    bg: "bg-venue-sportplatz/10",
    border: "border-l-venue-sportplatz",
    text: "text-venue-sportplatz",
  },
  MZH: {
    bg: "bg-venue-mzh/10",
    border: "border-l-venue-mzh",
    text: "text-venue-mzh",
  },
  Turnhalle: {
    bg: "bg-venue-turnhalle/10",
    border: "border-l-venue-turnhalle",
    text: "text-venue-turnhalle",
  },
  Tanzraum: {
    bg: "bg-venue-tanzraum/10",
    border: "border-l-venue-tanzraum",
    text: "text-venue-tanzraum",
  },
};

/** Compute overlap columns for events so overlapping ones sit side by side */
function layoutEvents(events: CalendarEvent[]): (CalendarEvent & { col: number; totalCols: number })[] {
  if (events.length === 0) return [];

  const getFieldOrder = (event: CalendarEvent): number => {
    const match = /\(Feld\s*(\d+)\)/i.exec(event.title);
    if (!match) return 99;
    const fieldNumber = Number(match[1]);
    return Number.isFinite(fieldNumber) ? fieldNumber : 99;
  };

  const sorted = [...events].sort((a, b) => {
    const byStart = a.date.getTime() - b.date.getTime();
    if (byStart !== 0) return byStart;

    const byField = getFieldOrder(a) - getFieldOrder(b);
    if (byField !== 0) return byField;

    const byEnd = a.endDate.getTime() - b.endDate.getTime();
    if (byEnd !== 0) return byEnd;

    return a.title.localeCompare(b.title, "de");
  });

  const columns: CalendarEvent[][] = [];

  for (const event of sorted) {
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
    col.forEach((event) => {
      result.push({ ...event, col: colIndex, totalCols });
    });
  });

  return result;
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
    left: `calc(${leftPercent}% + 2px)`,
    width: `calc(${widthPercent}% - 4px)`,
  };
}

function TimeGrid({ events, venue }: { events: CalendarEvent[]; venue: Venue }) {
  const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
  const colors = venueColors[venue];
  const laid = layoutEvents(events);

  return (
    <div className="relative flex">
      {/* Hour labels */}
      <div className="w-12 flex-shrink-0">
        {hours.map((h) => (
          <div
            key={h}
            className="text-[10px] text-muted-foreground text-right pr-2"
            style={{ height: `${HOUR_HEIGHT}px` }}
          >
            {`${h.toString().padStart(2, "0")}:00`}
          </div>
        ))}
      </div>

      {/* Grid + Events */}
      <div className="flex-1 relative border-l border-border">
        {/* Grid lines */}
        {hours.map((h) => (
          <div
            key={h}
            className="border-b border-border/50"
            style={{ height: `${HOUR_HEIGHT}px` }}
          />
        ))}

        {/* Events */}
        {laid.map((event) => {
          const style = getEventStyle(event);
          const SportIcon = sportIcons[event.sport];
          return (
            <div
              key={event.id}
              className={cn(
                "absolute rounded-md border-l-3 px-1.5 py-1 overflow-hidden cursor-default",
                colors.bg,
                colors.border
              )}
              style={style}
            >
              <div className="flex items-center gap-1">
                {SportIcon && <SportIcon className="h-3 w-3 flex-shrink-0 text-muted-foreground" />}
                <p className="text-[11px] font-semibold text-card-foreground truncate leading-tight">
                  {event.title}
                </p>
              </div>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                <Clock className="h-2.5 w-2.5" />
                {format(event.date, "HH:mm")} – {format(event.endDate, "HH:mm")}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DayView() {
  const { filteredEvents, currentDate, activeVenues, setCurrentDate } = useCalendar();
  const isMobile = useIsMobile();

  const dayEvents = filteredEvents.filter((e) => isSameDay(e.date, currentDate));

  const eventsByVenue = (v: Venue) => dayEvents.filter((e) => e.venue === v);
  const visibleVenues = venues.filter((v) => activeVenues.has(v));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">
            {format(currentDate, "d. MMMM yyyy", { locale: de })}
          </h2>
          <p className="text-sm text-muted-foreground">
            {format(currentDate, "EEEE", { locale: de })}, Woche{" "}
            {format(currentDate, "w", { locale: de })}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addDays(currentDate, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="text-xs" onClick={() => setCurrentDate(new Date())}>
            Heute
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addDays(currentDate, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isMobile ? (
        <Tabs defaultValue={visibleVenues[0] || "Sportplatz"}>
          <TabsList className="w-full">
            {visibleVenues.map((v) => (
              <TabsTrigger key={v} value={v} className="flex-1 gap-1.5 text-xs">
                <span
                  className={cn(
                    "w-2 h-2 rounded-full",
                    v === "Sportplatz" && "bg-venue-sportplatz",
                    v === "MZH" && "bg-venue-mzh",
                    v === "Turnhalle" && "bg-venue-turnhalle",
                    v === "Tanzraum" && "bg-venue-tanzraum"
                  )}
                />
                {v}
              </TabsTrigger>
            ))}
          </TabsList>
          {visibleVenues.map((v) => (
            <TabsContent key={v} value={v}>
              {eventsByVenue(v).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Keine Termine
                </p>
              ) : (
                <TimeGrid events={eventsByVenue(v)} venue={v} />
              )}
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <div className="flex gap-4">
          {visibleVenues.map((v) => (
            <div key={v} className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 pb-1 border-b border-border">
                <span
                  className={cn(
                    "w-2.5 h-2.5 rounded-full",
                    v === "Sportplatz" && "bg-venue-sportplatz",
                    v === "MZH" && "bg-venue-mzh",
                    v === "Turnhalle" && "bg-venue-turnhalle",
                    v === "Tanzraum" && "bg-venue-tanzraum"
                  )}
                />
                <h3 className="text-sm font-semibold text-foreground">{v}</h3>
                <span className="text-xs text-muted-foreground">
                  ({eventsByVenue(v).length})
                </span>
              </div>
              {eventsByVenue(v).length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">
                  Keine Termine
                </p>
              ) : (
                <TimeGrid events={eventsByVenue(v)} venue={v} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
