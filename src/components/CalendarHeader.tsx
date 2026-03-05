import { useCalendar } from "@/context/CalendarContext";
import { CalendarView } from "@/types/calendar";
import { useEffect } from "react";
import {
  Calendar as CalendarIcon,
  ClipboardList,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

const viewLabels: Record<CalendarView, string> = {
  day: "Tag",
  week: "Woche",
  month: "Monat",
};

interface CalendarHeaderProps {
  onOpenFilter: () => void;
}

export function CalendarHeader({ onOpenFilter }: CalendarHeaderProps) {
  const { view, setView, mode, setMode } = useCalendar();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isMobile && view === "week") {
      setView("day");
    }
  }, [isMobile, view, setView]);

  const availableViews: CalendarView[] = isMobile ? ["day", "month"] : ["day", "week", "month"];

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

      <div className="flex bg-muted rounded-lg p-0.5">
        <button
          onClick={() => setMode("standard")}
          className={cn(
            "px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors inline-flex items-center gap-1.5",
            mode === "standard"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <CalendarIcon className="h-3.5 w-3.5" />
          Standard
        </button>
        <button
          onClick={() => setMode("plan")}
          className={cn(
            "px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors inline-flex items-center gap-1.5",
            mode === "plan"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <ClipboardList className="h-3.5 w-3.5" />
          Plan
        </button>
      </div>

      <div className="flex-1" />

      {/* View switcher */}
      <div className="flex bg-muted rounded-lg p-0.5">
        {availableViews.map((v) => (
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
