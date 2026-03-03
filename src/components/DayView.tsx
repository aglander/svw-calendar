import { useCalendar } from "@/context/CalendarContext";
import { CalendarEvent, Venue } from "@/types/calendar";
import { format, isSameDay } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import { Clock } from "lucide-react";

const HOUR_START = 7;
const HOUR_END = 22;
const HOUR_HEIGHT = 64; // px per hour

const venues: Venue[] = ["Sportplatz", "MZH", "Turnhalle"];

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
};

function getEventStyle(event: CalendarEvent) {
  const startMinutes = event.date.getHours() * 60 + event.date.getMinutes();
  const endMinutes = event.endDate.getHours() * 60 + event.endDate.getMinutes();
  const top = ((startMinutes - HOUR_START * 60) / 60) * HOUR_HEIGHT;
  const height = Math.max(((endMinutes - startMinutes) / 60) * HOUR_HEIGHT, 24);
  return { top: `${top}px`, height: `${height}px` };
}

function TimeGrid({ events, venue }: { events: CalendarEvent[]; venue: Venue }) {
  const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
  const colors = venueColors[venue];

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
        {events.map((event) => {
          const style = getEventStyle(event);
          return (
            <div
              key={event.id}
              className={cn(
                "absolute left-1 right-1 rounded-md border-l-3 px-2 py-1 overflow-hidden cursor-default",
                colors.bg,
                colors.border
              )}
              style={style}
            >
              <p className="text-xs font-semibold text-card-foreground truncate leading-tight">
                {event.title}
              </p>
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
  const { filteredEvents, currentDate, activeVenues } = useCalendar();
  const isMobile = useIsMobile();

  const dayEvents = filteredEvents.filter((e) => isSameDay(e.date, currentDate));

  const eventsByVenue = (v: Venue) => dayEvents.filter((e) => e.venue === v);
  const visibleVenues = venues.filter((v) => activeVenues.has(v));

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-bold text-foreground">
          {format(currentDate, "d. MMMM yyyy", { locale: de })}
        </h2>
        <p className="text-sm text-muted-foreground">
          {format(currentDate, "EEEE", { locale: de })}, Woche{" "}
          {format(currentDate, "w", { locale: de })}
        </p>
      </div>

      {isMobile ? (
        /* Mobile: Tabs for venues */
        <Tabs defaultValue={visibleVenues[0] || "Sportplatz"}>
          <TabsList className="w-full">
            {visibleVenues.map((v) => (
              <TabsTrigger key={v} value={v} className="flex-1 gap-1.5 text-xs">
                <span
                  className={cn(
                    "w-2 h-2 rounded-full",
                    v === "Sportplatz" && "bg-venue-sportplatz",
                    v === "MZH" && "bg-venue-mzh",
                    v === "Turnhalle" && "bg-venue-turnhalle"
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
        /* Desktop: Columns for venues */
        <div className="flex gap-4">
          {visibleVenues.map((v) => (
            <div key={v} className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 pb-1 border-b border-border">
                <span
                  className={cn(
                    "w-2.5 h-2.5 rounded-full",
                    v === "Sportplatz" && "bg-venue-sportplatz",
                    v === "MZH" && "bg-venue-mzh",
                    v === "Turnhalle" && "bg-venue-turnhalle"
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
