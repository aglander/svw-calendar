import { useCalendar } from "@/context/CalendarContext";
import { sportGroups } from "@/data/calendarData";
import { Venue } from "@/types/calendar";
import { ChevronDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

const venueColors: Record<Venue, string> = {
  Sportplatz: "bg-venue-sportplatz",
  MZH: "bg-venue-mzh",
  Turnhalle: "bg-venue-turnhalle",
  Tanzraum: "bg-venue-tanzraum",
};

export function FilterSidebar() {
  const {
    mode,
    activeTeamIds,
    toggleTeam,
    toggleSport,
    isSportActive,
    activeVenues,
    toggleVenue,
  } = useCalendar();

  return (
    <div className="flex flex-col gap-6 p-4">
      {/* Venue Filter */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wider">
          Spielstätten
        </h3>
        <div className="flex flex-col gap-2">
          {(["Sportplatz", "MZH", "Turnhalle", "Tanzraum"] as Venue[]).map((venue) => (
            <label
              key={venue}
              className="flex items-center gap-3 cursor-pointer rounded-lg px-3 py-2 hover:bg-accent transition-colors"
            >
              <Checkbox
                checked={activeVenues.has(venue)}
                onCheckedChange={() => toggleVenue(venue)}
              />
              <span className={cn("w-2.5 h-2.5 rounded-full", venueColors[venue])} />
              <span className="text-sm font-medium">{venue}</span>
            </label>
          ))}
        </div>
      </div>

      {mode === "standard" ? (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wider">
            Mannschaften
          </h3>
          <div className="flex flex-col gap-1">
            {sportGroups.map((group) => {
              const teamIds =
                group.teams.length > 0
                  ? group.teams.map((t) => t.id)
                  : [`sport-${group.sport}`];
              const allActive = isSportActive(teamIds);
              const someActive =
                !allActive && teamIds.some((id) => activeTeamIds.has(id));

              if (group.teams.length === 0) {
                return (
                  <label
                    key={group.sport}
                    className="flex items-center gap-3 cursor-pointer rounded-lg px-3 py-2 hover:bg-accent transition-colors"
                  >
                    <Checkbox
                      checked={allActive}
                      onCheckedChange={() => toggleSport(group.sport, teamIds)}
                    />
                    <span className="text-sm font-medium">{group.sport}</span>
                  </label>
                );
              }

              return (
                <Collapsible key={group.sport}>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-3 cursor-pointer rounded-lg px-3 py-2 hover:bg-accent transition-colors flex-1">
                      <Checkbox
                        checked={allActive}
                        className={someActive ? "opacity-60" : ""}
                        onCheckedChange={() => toggleSport(group.sport, teamIds)}
                      />
                      <span className="text-sm font-semibold">{group.sport}</span>
                    </label>
                    <CollapsibleTrigger className="p-2 hover:bg-accent rounded-md transition-colors group">
                      <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                    </CollapsibleTrigger>
                  </div>
                  <CollapsibleContent>
                    <div className="ml-4 flex flex-col gap-0.5 pb-1">
                      {group.teams.map((team) => (
                        <label
                          key={team.id}
                          className="flex items-center gap-3 cursor-pointer rounded-lg px-3 py-1.5 hover:bg-accent transition-colors"
                        >
                          <Checkbox
                            checked={activeTeamIds.has(team.id)}
                            onCheckedChange={() => toggleTeam(team.id)}
                          />
                          <span className="text-sm">{team.name}</span>
                        </label>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-border p-3 text-xs text-muted-foreground">
          Plan-Modus zeigt alle Belegungen aus dem Betreiberplan (SVW, Schule, extern).
        </div>
      )}
    </div>
  );
}
