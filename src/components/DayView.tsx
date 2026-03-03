import { useCalendar } from "@/context/CalendarContext";
import { EventCard } from "@/components/EventCard";
import { format, isSameDay } from "date-fns";
import { de } from "date-fns/locale";

export function DayView() {
  const { filteredEvents, currentDate } = useCalendar();

  const dayEvents = filteredEvents.filter((e) => isSameDay(e.date, currentDate));

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-bold text-foreground">
        {format(currentDate, "EEEE, d. MMMM yyyy", { locale: de })}
      </h2>
      {dayEvents.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">Keine Termine an diesem Tag</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {dayEvents.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
