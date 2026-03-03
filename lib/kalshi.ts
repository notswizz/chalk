const KALSHI_BASE = 'https://api.elections.kalshi.com/trade-api/v2';

export interface KalshiMarket {
  ticker: string;
  title: string;
  yes_bid: number;
  yes_ask: number;
  volume: number;
  close_time: string;
  floor_strike?: number;
  event_ticker?: string;
}

export interface GameOdds {
  away: number | null;
  home: number | null;
  volume: number;
  spread?: { team: string; line: number } | null;
}

const MONTH_MAP: Record<number, string> = {
  1: 'JAN', 2: 'FEB', 3: 'MAR', 4: 'APR', 5: 'MAY', 6: 'JUN',
  7: 'JUL', 8: 'AUG', 9: 'SEP', 10: 'OCT', 11: 'NOV', 12: 'DEC',
};

// Convert a UTC date to US Eastern time components
// Kalshi uses Eastern time dates for their tickers
function toEastern(date: Date): { year: number; month: number; day: number } {
  const eastern = new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  return { year: eastern.getFullYear(), month: eastern.getMonth() + 1, day: eastern.getDate() };
}

export const ESPN_TO_KALSHI: Record<string, string> = {
  'BOS': 'BOS', 'MIL': 'MIL', 'LAL': 'LAL',
  'PHX': 'PHX', 'SAC': 'SAC', 'DET': 'DET', 'CLE': 'CLE',
  'TOR': 'TOR', 'CHI': 'CHI', 'OKC': 'OKC',
  'DAL': 'DAL', 'CHA': 'CHA', 'DEN': 'DEN',
  'HOU': 'HOU', 'LAC': 'LAC',
  'PHI': 'PHI', 'MEM': 'MEM', 'ATL': 'ATL',
  'IND': 'IND', 'MIA': 'MIA', 'MIN': 'MIN', 'POR': 'POR',
  'BKN': 'BKN', 'ORL': 'ORL',
  // ESPN abbreviations that differ from Kalshi
  'GS': 'GSW',    // Golden State Warriors
  'NY': 'NYK',    // New York Knicks
  'UTAH': 'UTA',  // Utah Jazz
  'WSH': 'WAS',   // Washington Wizards
  'SA': 'SAS',    // San Antonio Spurs
  'NO': 'NOP',    // New Orleans Pelicans
};

export async function getNBAOdds(): Promise<KalshiMarket[]> {
  // No status filter — returns active (today) + recent finalized, sorted newest first
  const res = await fetch(
    `${KALSHI_BASE}/markets?series_ticker=KXNBAGAME&limit=200`,
    { next: { revalidate: 60 } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.markets || [];
}

export async function getNBASpreads(): Promise<KalshiMarket[]> {
  const res = await fetch(
    `${KALSHI_BASE}/markets?series_ticker=KXNBASPREAD&limit=200`,
    { next: { revalidate: 60 } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.markets || [];
}

export function buildKalshiTicker(date: Date, awayAbbr: string, homeAbbr: string): string {
  const et = toEastern(date);
  const yy = et.year.toString().slice(2);
  const mon = MONTH_MAP[et.month];
  const dd = et.day.toString().padStart(2, '0');
  const away = ESPN_TO_KALSHI[awayAbbr] || awayAbbr;
  const home = ESPN_TO_KALSHI[homeAbbr] || homeAbbr;
  return `KXNBAGAME-${yy}${mon}${dd}${away}${home}`;
}

export function buildSpreadEventTicker(date: Date, awayAbbr: string, homeAbbr: string): string {
  const et = toEastern(date);
  const yy = et.year.toString().slice(2);
  const mon = MONTH_MAP[et.month];
  const dd = et.day.toString().padStart(2, '0');
  const away = ESPN_TO_KALSHI[awayAbbr] || awayAbbr;
  const home = ESPN_TO_KALSHI[homeAbbr] || homeAbbr;
  return `KXNBASPREAD-${yy}${mon}${dd}${away}${home}`;
}

// Find the live spread line — the market closest to 50% yes_bid
export function matchSpread(
  spreadMarkets: KalshiMarket[],
  spreadEventTicker: string,
): { team: string; line: number } | null {
  const gameMarkets = spreadMarkets.filter((m) => m.event_ticker === spreadEventTicker);
  if (gameMarkets.length === 0) return null;

  const best = gameMarkets.reduce((a, b) =>
    Math.abs((a.yes_bid ?? 0) - 50) <= Math.abs((b.yes_bid ?? 0) - 50) ? a : b
  );

  if (!best.floor_strike) return null;

  // Extract team abbr from ticker: KXNBASPREAD-26MAR02BOSMIL-BOS5 → BOS
  const suffix = best.ticker.split('-').pop() || '';
  const teamMatch = suffix.match(/^([A-Z]+)/);
  const team = teamMatch ? teamMatch[1] : '';

  return { team, line: best.floor_strike };
}

export function matchOdds(
  markets: KalshiMarket[],
  baseTicker: string,
  awayAbbr: string,
  homeAbbr: string,
  spreadMarkets?: KalshiMarket[],
  spreadEventTicker?: string,
): GameOdds {
  const away = ESPN_TO_KALSHI[awayAbbr] || awayAbbr;
  const home = ESPN_TO_KALSHI[homeAbbr] || homeAbbr;

  const awayMarket = markets.find((m) => m.ticker === `${baseTicker}-${away}`);
  const homeMarket = markets.find((m) => m.ticker === `${baseTicker}-${home}`);

  const spread = spreadMarkets && spreadEventTicker
    ? matchSpread(spreadMarkets, spreadEventTicker)
    : null;

  return {
    away: awayMarket?.yes_bid ?? null,
    home: homeMarket?.yes_bid ?? null,
    volume: (awayMarket?.volume ?? 0) + (homeMarket?.volume ?? 0),
    spread,
  };
}
