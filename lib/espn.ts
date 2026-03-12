import { Game, Sport, SportConfig, SPORTS, Team, TournamentTeam } from './types';

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports';

function getEndpoint(sport: Sport): string {
  const config = SPORTS.find((s) => s.key === sport);
  if (!config) throw new Error(`Unknown sport: ${sport}`);
  return `${ESPN_BASE}/${config.espnPath}/scoreboard`;
}

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
    id: c?.team?.id ?? '',
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
  const endpoint = getEndpoint(sport);
  // groups=50 includes all D1 conferences for college basketball
  const groupsParam = sport === 'ncaam' ? '&groups=50' : '';
  const res = await fetch(`${endpoint}?dates=${dateParam}&limit=300${groupsParam}`, { next: { revalidate: 30 } });
  if (!res.ok) return [];
  const data = await res.json();
  const events = data.events ?? [];
  return events.map((e: unknown) => parseGame(e, sport));
}

export async function fetchAllGames(): Promise<Game[]> {
  const enabledSports = SPORTS.filter((s) => s.enabled).map((s) => s.key);
  const results = await Promise.allSettled(enabledSports.map((s) => fetchGames(s)));
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
 * Fetch player box scores for a live or finished game from ESPN.
 * Returns a map of normalized player name → stats.
 */
export async function fetchPlayerBoxScore(gameId: string, sport?: string): Promise<PlayerBoxScore[]> {
  const path = sport === 'ncaam' ? 'basketball/mens-college-basketball' : 'basketball/nba';
  const res = await fetch(
    `${ESPN_BASE}/${path}/summary?event=${gameId}`,
    { cache: 'no-store' }
  );
  if (!res.ok) return [];
  const data = await res.json();

  const teams = data.boxscore?.players ?? [];
  const players: PlayerBoxScore[] = [];

  for (const team of teams) {
    const athletes = team.statistics?.[0]?.athletes ?? [];
    for (const a of athletes) {
      if (a.didNotPlay || !a.stats?.length) continue;
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

/** Detect tournament round from ESPN event notes. */
export function detectTournamentRound(event: any): string | null {
  const headline: string = event.competitions?.[0]?.notes?.[0]?.headline || '';
  if (headline.includes('First Round')) return 'round_of_64';
  if (headline.includes('Second Round')) return 'round_of_32';
  if (headline.includes('Sweet 16')) return 'sweet_16';
  if (headline.includes('Elite Eight') || headline.includes('Elite 8')) return 'elite_eight';
  if (headline.includes('Final Four')) return 'final_four';
  if (headline.includes('National Championship') || headline.includes('Championship')) return 'championship';
  return null;
}

/** Fetch NCAA tournament scoreboard with expanded date range. */
export async function fetchTournamentGames(): Promise<{ games: Game[]; roundMap: Record<string, string> }> {
  const now = new Date();
  const year = now.getFullYear();
  // Tournament typically runs mid-March through early April
  const startDate = `${year}0301`;
  const endDate = `${year}0410`;
  const res = await fetch(
    `${ESPN_BASE}/basketball/mens-college-basketball/scoreboard?dates=${startDate}-${endDate}&limit=100`,
    { next: { revalidate: 60 } }
  );
  if (!res.ok) return { games: [], roundMap: {} };
  const data = await res.json();
  const events = data.events ?? [];

  const games: Game[] = [];
  const roundMap: Record<string, string> = {};

  for (const event of events) {
    const round = detectTournamentRound(event);
    if (round) {
      const game = parseGame(event, 'ncaam');
      games.push(game);
      roundMap[game.id] = round;
    }
  }

  return { games, roundMap };
}

/** Fetch tournament teams from ESPN rankings endpoint. */
export async function fetchTournamentTeams(): Promise<TournamentTeam[]> {
  try {
    const res = await fetch(
      `${ESPN_BASE}/basketball/mens-college-basketball/rankings`,
      { next: { revalidate: 300 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const teams: TournamentTeam[] = [];
    const seen = new Set<string>();

    for (const ranking of data.rankings ?? []) {
      for (const rank of ranking.ranks ?? []) {
        const team = rank.team;
        if (!team || seen.has(team.id)) continue;
        seen.add(team.id);
        teams.push({
          id: team.id,
          name: team.name || team.displayName || 'Unknown',
          abbreviation: team.abbreviation || '???',
          seed: rank.current ?? 0,
          logo: team.logo || team.logos?.[0]?.href || '',
        });
      }
    }
    return teams;
  } catch {
    return [];
  }
}

const gameCache = new Map<string, { data: Game; expires: number }>();
const GAME_CACHE_TTL = 30 * 1000; // 30 seconds

export async function fetchGameById(gameId: string): Promise<Game | null> {
  const cached = gameCache.get(gameId);
  if (cached && cached.expires > Date.now()) return cached.data;

  // Try each sport's summary endpoint until one works
  const sportPaths: { path: string; sport: Sport }[] = [
    { path: 'basketball/nba', sport: 'nba' },
    { path: 'basketball/mens-college-basketball', sport: 'ncaam' },
  ];

  for (const { path, sport } of sportPaths) {
    try {
      const res = await fetch(
        `${ESPN_BASE}/${path}/summary?event=${gameId}`,
        { next: { revalidate: 30 } }
      );
      if (!res.ok) continue;
      const data = await res.json();
      const event = data.header?.competitions?.[0];
      if (!event) continue;

      const competitors = event.competitors ?? [];
      const home = competitors.find((c: any) => c.homeAway === 'home');
      const away = competitors.find((c: any) => c.homeAway === 'away');

      const toTeam = (c: any, side: 'home' | 'away'): Team => ({
        id: c?.team?.id ?? '',
        abbreviation: c?.team?.abbreviation ?? '???',
        displayName: c?.team?.displayName ?? 'Unknown',
        logo: c?.team?.logo ?? c?.team?.logos?.[0]?.href ?? '',
        score: c?.score ?? '0',
        homeAway: side,
      });

      const statusType = event.status?.type ?? {};

      const game: Game = {
        id: gameId,
        sport,
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
      gameCache.set(gameId, { data: game, expires: Date.now() + GAME_CACHE_TTL });
      return game;
    } catch {
      continue;
    }
  }

  // Final fallback: scoreboard scan
  const allGames = await fetchAllGames();
  return allGames.find((g) => g.id === gameId) ?? null;
}
