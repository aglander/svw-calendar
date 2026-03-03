import { CalendarEvent, Venue } from "@/types/calendar";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { MapPin, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const venueDot: Record<Venue, string> = {
  Sportplatz: "bg-venue-sportplatz",
  MZH: "bg-venue-mzh",
  Turnhalle: "bg-venue-turnhalle",
};

const venueBorder: Record<Venue, string> = {
  Sportplatz: "border-l-venue-sportplatz",
  MZH: "border-l-venue-mzh",
  Turnhalle: "border-l-venue-turnhalle",
};

export function EventCard({ event }: { event: CalendarEvent }) {
  return (
    <div
      className={cn(
        "bg-card rounded-lg border border-border p-3 shadow-sm hover:shadow-md transition-shadow",
        "border-l-4",
        venueBorder[event.venue]
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-card-foreground truncate">
            {event.title}
          </h4>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {format(event.date, "HH:mm")} – {format(event.endDate, "HH:mm")}
            </span>
            <span className="flex items-center gap-1">
              <span className={cn("w-2 h-2 rounded-full inline-block", venueDot[event.venue])} />
              {event.venue}
            </span>
          </div>
        </div>
        <span className="text-[10px] font-medium bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full whitespace-nowrap">
          {event.sport}
        </span>
      </div>
    </div>
  );
}
