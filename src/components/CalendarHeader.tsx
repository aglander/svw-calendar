import { useCalendar } from "@/context/CalendarContext";
import { CalendarView } from "@/types/calendar";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalIcon,
  Menu,
} from "lucide-react";
import { addDays, addWeeks, addMonths, format } from "date-fns";
import { de } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const viewLabels: Record<CalendarView, string> = {
  day: "Tag",
  week: "Woche",
  month: "Monat",
};

interface CalendarHeaderProps {
  onOpenFilter: () => void;
}

export function CalendarHeader({ onOpenFilter }: CalendarHeaderProps) {
  const { currentDate, setCurrentDate, view, setView } = useCalendar();

  const navigate = (dir: -1 | 1) => {
    if (view === "day") setCurrentDate(addDays(currentDate, dir));
    else if (view === "week") setCurrentDate(addWeeks(currentDate, dir));
    else setCurrentDate(addMonths(currentDate, dir));
  };

  const goToday = () => setCurrentDate(new Date());

  return (
    <header className="flex items-center gap-2 px-4 py-3 bg-card border-b border-border sticky top-0 z-20">
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onOpenFilter}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Nav */}
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => navigate(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <Button variant="outline" size="sm" onClick={goToday} className="text-xs">
        Heute
      </Button>

      <div className="flex-1" />

      {/* View switcher */}
      <div className="flex bg-muted rounded-lg p-0.5">
        {(["day", "week", "month"] as CalendarView[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
              view === v
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {viewLabels[v]}
          </button>
        ))}
      </div>
    </header>
  );
}
