import { useCalendar } from "@/context/CalendarContext";
import {
  addMonths,
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getEventColorSet } from "@/lib/eventColors";

export function MonthView() {
  const { filteredEvents, currentDate, setCurrentDate, setView } = useCalendar();

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { locale: de });
  const calEnd = endOfWeek(monthEnd, { locale: de });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const weekdays = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-foreground">
          {format(currentDate, "MMMM yyyy", { locale: de })}
        </h2>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addMonths(currentDate, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="text-xs" onClick={() => setCurrentDate(new Date())}>
            Heute
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
        {weekdays.map((wd) => (
          <div
            key={wd}
            className="bg-muted text-center text-xs font-semibold text-muted-foreground py-2"
          >
            {wd}
          </div>
        ))}
        {days.map((day) => {
          const dayEvents = filteredEvents.filter((e) => isSameDay(e.date, day));
          const isToday = isSameDay(day, new Date());
          const isCurrentMonth = isSameMonth(day, currentDate);

          return (
            <button
              key={day.toISOString()}
              onClick={() => {
                setCurrentDate(day);
                setView("day");
              }}
              className={cn(
                "bg-card min-h-[60px] md:min-h-[80px] p-1 text-left transition-colors hover:bg-accent",
                !isCurrentMonth && "opacity-40"
              )}
            >
              <span
                className={cn(
                  "text-xs font-medium inline-flex items-center justify-center w-6 h-6 rounded-full",
                  isToday && "bg-primary text-primary-foreground"
                )}
              >
                {format(day, "d")}
              </span>
              {dayEvents.length > 0 && (
                <div className="flex flex-wrap gap-0.5 mt-0.5">
                  {dayEvents.slice(0, 3).map((e) => (
                    <span
                      key={e.id}
                      className={cn("w-1.5 h-1.5 rounded-full", getEventColorSet(e).dot)}
                      style={{ backgroundColor: getEventColorSet(e).dotColor }}
                    />
                  ))}
                  {dayEvents.length > 3 && (
                    <span className="text-[9px] text-muted-foreground">
                      +{dayEvents.length - 3}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
