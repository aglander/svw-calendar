import { useState } from "react";
import { CalendarProvider, useCalendar } from "@/context/CalendarContext";
import { CalendarHeader } from "@/components/CalendarHeader";
import { FilterSidebar } from "@/components/FilterSidebar";
import { DayView } from "@/components/DayView";
import { WeekView } from "@/components/WeekView";
import { MonthView } from "@/components/MonthView";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIsMobile } from "@/hooks/use-mobile";

function CalendarContent() {
  const { view, isLoading, error } = useCalendar();
  const [filterOpen, setFilterOpen] = useState(false);
  const isMobile = useIsMobile();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <CalendarHeader onOpenFilter={() => setFilterOpen(true)} />

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block w-72 border-r border-border bg-card overflow-y-auto">
          <ScrollArea className="h-[calc(100vh-52px)]">
            <FilterSidebar />
          </ScrollArea>
        </aside>

        {/* Mobile filter sheet */}
        <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
          <SheetContent side="left" className="w-80 p-0">
            <div className="pt-6 px-4 pb-2">
              <h2 className="text-base font-bold text-foreground">Filter</h2>
            </div>
            <ScrollArea className="h-[calc(100vh-80px)]">
              <FilterSidebar />
            </ScrollArea>
          </SheetContent>
        </Sheet>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {isLoading && (
            <p className="text-sm text-muted-foreground mb-4">Kalenderdaten werden geladen...</p>
          )}
          {error && (
            <p className="text-sm text-destructive mb-4">{error}</p>
          )}
          {view === "day" && <DayView />}
          {view === "week" && !isMobile && <WeekView />}
          {view === "month" && <MonthView />}
        </main>
      </div>
    </div>
  );
}

const Index = () => {
  return (
    <CalendarProvider>
      <CalendarContent />
    </CalendarProvider>
  );
};

export default Index;
