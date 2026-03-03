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

/** Stat mapping from our bet stat keys to ESPN stats array indices / parsing */
const STAT_EXTRACTORS: Record<string, (stats: string[]) => number> = {
  points: (s) => parseInt(s[1]) || 0,
  rebounds: (s) => parseInt(s[5]) || 0,
  assists: (s) => parseInt(s[6]) || 0,
  threes: (s) => parseInt(s[3]?.split('-')[0]) || 0,
};

export interface PlayerBoxScore {
  name: string;
  stats: Record<string, number>;
}

/**
 * Fetch player box scores for a finished game from ESPN.
 * Returns a map of normalized player name → stats.
 */
export async function fetchPlayerBoxScore(gameId: string): Promise<PlayerBoxScore[]> {
  const res = await fetch(
    `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${gameId}`,
    { cache: 'no-store' }
  );
  if (!res.ok) return [];
  const data = await res.json();

  const teams = data.boxscore?.players ?? [];
  const players: PlayerBoxScore[] = [];

  for (const team of teams) {
    const athletes = team.statistics?.[0]?.athletes ?? [];
    for (const a of athletes) {
      if (a.didNotPlay || !a.active || !a.stats?.length) continue;
      const name: string = a.athlete?.displayName ?? '';
      if (!name) continue;

      const extracted: Record<string, number> = {};
      for (const [key, extractor] of Object.entries(STAT_EXTRACTORS)) {
        extracted[key] = extractor(a.stats);
      }
      players.push({ name, stats: extracted });
    }
  }

  return players;
}

/**
 * Find a player's stat value from box score data.
 * Uses case-insensitive substring matching to handle name variations.
 */
export function findPlayerStat(
  players: PlayerBoxScore[],
  playerName: string,
  stat: string
): number | null {
  const normalized = playerName.toLowerCase().trim();

  // Try exact match first
  let match = players.find((p) => p.name.toLowerCase() === normalized);

  // Try last name match
  if (!match) {
    const lastName = normalized.split(' ').pop() ?? '';
    const lastNameMatches = players.filter((p) => p.name.toLowerCase().split(' ').pop() === lastName);
    if (lastNameMatches.length === 1) match = lastNameMatches[0];
  }

  // Try substring match
  if (!match) {
    match = players.find((p) => p.name.toLowerCase().includes(normalized) || normalized.includes(p.name.toLowerCase()));
  }

  if (!match) return null;
  return match.stats[stat] ?? null;
}

export async function fetchGameById(gameId: string): Promise<Game | null> {
  // Fetch the single game summary directly instead of loading all games
  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${gameId}`,
      { next: { revalidate: 30 } }
    );
    if (!res.ok) {
      // Fallback to scoreboard scan
      const allGames = await fetchAllGames();
      return allGames.find((g) => g.id === gameId) ?? null;
    }
    const data = await res.json();
    const event = data.header?.competitions?.[0];
    if (!event) return null;

    const competitors = event.competitors ?? [];
    const home = competitors.find((c: any) => c.homeAway === 'home');
    const away = competitors.find((c: any) => c.homeAway === 'away');

    const toTeam = (c: any, side: 'home' | 'away'): Team => ({
      abbreviation: c?.team?.abbreviation ?? '???',
      displayName: c?.team?.displayName ?? 'Unknown',
      logo: c?.team?.logo ?? c?.team?.logos?.[0]?.href ?? '',
      score: c?.score ?? '0',
      homeAway: side,
    });

    const statusType = event.status?.type ?? {};

    return {
      id: gameId,
      sport: 'nba',
      date: data.header?.competitions?.[0]?.date ?? '',
      state: statusType.state ?? 'pre',
      displayClock: event.status?.displayClock ?? '',
      period: event.status?.period ?? 0,
      shortDetail: statusType.shortDetail ?? '',
      homeTeam: toTeam(home, 'home'),
      awayTeam: toTeam(away, 'away'),
      venue: data.gameInfo?.venue?.fullName ?? '',
      broadcast:
        event.broadcasts?.[0]?.names?.join(', ') ??
        event.geoBroadcasts?.[0]?.media?.shortName ??
        '',
    };
  } catch {
    // Fallback to scoreboard scan
    const allGames = await fetchAllGames();
    return allGames.find((g) => g.id === gameId) ?? null;
  }
}
