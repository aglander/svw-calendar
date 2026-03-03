import { useCalendar } from "@/context/CalendarContext";
import { EventCard } from "@/components/EventCard";
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
} from "date-fns";
import { de } from "date-fns/locale";

export function WeekView() {
  const { filteredEvents, currentDate } = useCalendar();

  const weekStart = startOfWeek(currentDate, { locale: de });
  const weekEnd = endOfWeek(currentDate, { locale: de });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-bold text-foreground">
        {format(weekStart, "d. MMM", { locale: de })} –{" "}
        {format(weekEnd, "d. MMM yyyy", { locale: de })}
      </h2>
      <div className="flex flex-col gap-4">
        {days.map((day) => {
          const dayEvents = filteredEvents.filter((e) => isSameDay(e.date, day));
          const isToday = isSameDay(day, new Date());
          return (
            <div key={day.toISOString()}>
              <h3
                className={`text-sm font-semibold mb-2 ${
                  isToday ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {format(day, "EEEE, d. MMM", { locale: de })}
                {isToday && (
                  <span className="ml-2 text-[10px] bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                    Heute
                  </span>
                )}
              </h3>
              {dayEvents.length === 0 ? (
                <p className="text-xs text-muted-foreground pl-2">–</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {dayEvents.map((e) => (
                    <EventCard key={e.id} event={e} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
