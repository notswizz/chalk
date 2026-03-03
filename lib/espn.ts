import { Game, Sport, Team } from './types';

const ENDPOINTS: Record<Sport, string> = {
  nba: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
};

/** Today's date as YYYYMMDD in US Eastern (NBA schedule timezone). */
function getTodayET(): string {
  const now = new Date();
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const y = et.getFullYear();
  const m = String(et.getMonth() + 1).padStart(2, '0');
  const d = String(et.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function parseGame(event: any, sport: Sport): Game {
  const competition = event.competitions?.[0];
  const competitors = competition?.competitors ?? [];
  const home = competitors.find((c: any) => c.homeAway === 'home');
  const away = competitors.find((c: any) => c.homeAway === 'away');

  const toTeam = (c: any, side: 'home' | 'away'): Team => ({
    abbreviation: c?.team?.abbreviation ?? '???',
    displayName: c?.team?.displayName ?? 'Unknown',
    logo: c?.team?.logo ?? '',
    score: c?.score ?? '0',
    homeAway: side,
  });

  const status = event.status ?? {};
  const statusType = status.type ?? {};

  return {
    id: event.id,
    sport,
    date: event.date,
    state: statusType.state ?? 'pre',
    displayClock: status.displayClock ?? '',
    period: status.period ?? 0,
    shortDetail: statusType.shortDetail ?? '',
    homeTeam: toTeam(home, 'home'),
    awayTeam: toTeam(away, 'away'),
    venue: competition?.venue?.fullName ?? '',
    broadcast:
      competition?.broadcasts?.[0]?.names?.join(', ') ??
      competition?.geoBroadcasts?.[0]?.media?.shortName ??
      '',
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function fetchGames(sport: Sport): Promise<Game[]> {
  const dateParam = getTodayET();
  const res = await fetch(`${ENDPOINTS[sport]}?dates=${dateParam}`, { next: { revalidate: 30 } });
  if (!res.ok) return [];
  const data = await res.json();
  const events = data.events ?? [];
  return events.map((e: unknown) => parseGame(e, sport));
}

export async function fetchAllGames(): Promise<Game[]> {
  const sports: Sport[] = ['nba'];
  const results = await Promise.allSettled(sports.map((s) => fetchGames(s)));
  const games = results
    .filter((r) => r.status === 'fulfilled')
    .flatMap((r) => (r as PromiseFulfilledResult<Game[]>).value);

  // Sort: live first, then upcoming, then final
  const stateOrder: Record<string, number> = { in: 0, pre: 1, post: 2 };
  return games.sort((a, b) => {
    const orderDiff = (stateOrder[a.state] ?? 1) - (stateOrder[b.state] ?? 1);
    if (orderDiff !== 0) return orderDiff;
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });
}

export async function fetchGameById(gameId: string): Promise<Game | null> {
  const allGames = await fetchAllGames();
  return allGames.find((g) => g.id === gameId) ?? null;
}
