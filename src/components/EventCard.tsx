import { CalendarEvent } from "@/types/calendar";
import { format } from "date-fns";
import { CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { getEventColorSet } from "@/lib/eventColors";

export function EventCard({ event }: { event: CalendarEvent }) {
  const colors = getEventColorSet(event);

  return (
    <div
      className={cn(
        "bg-card rounded-lg border border-border p-3 shadow-sm hover:shadow-md transition-shadow",
        "border-l-4",
        colors.border
      )}
      style={{
        backgroundColor: colors.backgroundColor,
        borderLeftColor: colors.borderColor,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-card-foreground truncate">
            {event.title}
          </h4>
          {event.sourceType !== "shadow" && event.verification?.status === "verified" && (
            <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3 w-3" />
              Verifiziert
            </span>
          )}
          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {format(event.date, "HH:mm")} – {format(event.endDate, "HH:mm")}
            </span>
            <span className="flex items-center gap-1">
              <span
                className={cn("w-2 h-2 rounded-full inline-block", colors.dot)}
                style={{ backgroundColor: colors.dotColor }}
              />
              {event.venue}
            </span>
            <span className={cn("text-[10px] font-medium", colors.text)}>
              {event.bookingType === "schule"
                ? "Schule"
                : event.bookingType === "extern"
                  ? "Extern"
                  : event.bookingType === "gesperrt"
                    ? "Gesperrt"
                    : "SVW"}
            </span>
          </div>
        </div>
        <span className="text-[10px] font-medium bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full whitespace-nowrap">
          {event.sourceType === "shadow" ? "Plan" : event.sport}
        </span>
      </div>
    </div>
  );
}
