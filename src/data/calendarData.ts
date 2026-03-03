import { SportGroup, CalendarEvent, Venue } from "@/types/calendar";

export const sportGroups: SportGroup[] = [
  {
    sport: "Fußball",
    teams: [
      { id: "fb-1m", name: "1. Männer", sport: "Fußball" },
      { id: "fb-2m", name: "2. Männer", sport: "Fußball" },
      { id: "fb-ak40", name: "AK 40", sport: "Fußball" },
      { id: "fb-ak50", name: "AK 50", sport: "Fußball" },
      { id: "fb-u19", name: "A-Junioren | U19", sport: "Fußball" },
      { id: "fb-1cu15", name: "1. C-Junioren | U15", sport: "Fußball" },
      { id: "fb-2cu15", name: "2. C-Junioren | U15", sport: "Fußball" },
      { id: "fb-1du13", name: "1. D-Junioren | U13", sport: "Fußball" },
      { id: "fb-2du13", name: "2. D-Junioren | U13", sport: "Fußball" },
      { id: "fb-3du13", name: "3. D-Junioren | U13", sport: "Fußball" },
      { id: "fb-1eu11", name: "1. E-Junioren | U11", sport: "Fußball" },
      { id: "fb-2eu11", name: "2. E-Junioren | U11", sport: "Fußball" },
      { id: "fb-3eu11", name: "3. E-Junioren | U11", sport: "Fußball" },
      { id: "fb-1fu9", name: "1. F-Junioren | U9", sport: "Fußball" },
      { id: "fb-2fu9", name: "2. F-Junioren | U9", sport: "Fußball" },
      { id: "fb-3fu9", name: "3. F-Junioren | U9", sport: "Fußball" },
      { id: "fb-u7", name: "Bambinis | U7", sport: "Fußball" },
      { id: "fb-frauen", name: "Frauen", sport: "Fußball" },
      { id: "fb-cu15w", name: "C-Juniorinnen | U15", sport: "Fußball" },
      { id: "fb-1du13w", name: "1. D-Juniorinnen | U13", sport: "Fußball" },
      { id: "fb-2du13w", name: "2. D-Juniorinnen | U13", sport: "Fußball" },
    ],
  },
  {
    sport: "Basketball",
    teams: [
      { id: "bb-herren", name: "Herren", sport: "Basketball" },
      { id: "bb-u16", name: "U16", sport: "Basketball" },
      { id: "bb-u14u12", name: "U14 / U12", sport: "Basketball" },
    ],
  },
  { sport: "Volleyball", teams: [] },
  {
    sport: "Tischtennis",
    teams: [
      { id: "tt-1", name: "1. Mannschaft", sport: "Tischtennis" },
      { id: "tt-2", name: "2. Mannschaft", sport: "Tischtennis" },
      { id: "tt-3", name: "3. Mannschaft", sport: "Tischtennis" },
      { id: "tt-4", name: "4. Mannschaft", sport: "Tischtennis" },
      { id: "tt-jugend", name: "Jugend", sport: "Tischtennis" },
    ],
  },
  { sport: "Geräteturnen", teams: [] },
  { sport: "Gymnastik / Workout", teams: [] },
  { sport: "Tanzen", teams: [] },
  { sport: "Showdance", teams: [] },
  { sport: "DiscoDance", teams: [] },
  { sport: "Badminton", teams: [] },
];

// Helper: get all team IDs including sport-level ones for sports without teams
export function getAllTeamIds(): string[] {
  const ids: string[] = [];
  sportGroups.forEach((g) => {
    if (g.teams.length === 0) {
      ids.push(`sport-${g.sport}`);
    } else {
      g.teams.forEach((t) => ids.push(t.id));
    }
  });
  return ids;
}

const venues: Venue[] = ["Sportplatz", "MZH", "Turnhalle"];

function randomTime(base: Date, hourMin: number, hourMax: number): Date {
  const d = new Date(base);
  const h = hourMin + Math.floor(Math.random() * (hourMax - hourMin));
  const m = Math.random() > 0.5 ? 0 : 30;
  d.setHours(h, m, 0, 0);
  return d;
}

export function generateMockEvents(): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const allTeams: { id: string; name: string; sport: string }[] = [];
  sportGroups.forEach((g) => {
    if (g.teams.length === 0) {
      allTeams.push({ id: `sport-${g.sport}`, name: g.sport, sport: g.sport });
    } else {
      g.teams.forEach((t) => allTeams.push(t));
    }
  });

  const eventTypes = ["Training", "Spiel", "Turnier", "Freundschaftsspiel"];

  // Generate events for 30 days around today
  for (let dayOffset = -7; dayOffset <= 21; dayOffset++) {
    const day = new Date(today);
    day.setDate(day.getDate() + dayOffset);

    // 3-8 events per day
    const numEvents = 3 + Math.floor(Math.random() * 6);
    for (let i = 0; i < numEvents; i++) {
      const team = allTeams[Math.floor(Math.random() * allTeams.length)];
      const venue = venues[Math.floor(Math.random() * venues.length)];
      const type = eventTypes[Math.floor(Math.random() * eventTypes.length)];
      const start = randomTime(day, 8, 20);
      const end = new Date(start);
      end.setMinutes(end.getMinutes() + (type === "Training" ? 90 : 120));

      events.push({
        id: `evt-${dayOffset}-${i}`,
        title: `${type} – ${team.name}`,
        date: start,
        endDate: end,
        venue,
        teamId: team.id,
        sport: team.sport,
        teamName: team.name,
      });
    }
  }

  return events.sort((a, b) => a.date.getTime() - b.date.getTime());
}
