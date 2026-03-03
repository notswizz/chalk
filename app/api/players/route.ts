import { NextRequest, NextResponse } from 'next/server';

interface PlayerInfo {
  id: string;
  name: string;
  position: string;
  jersey: string;
}

const cache = new Map<string, { data: PlayerInfo[]; expires: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function fetchRoster(teamAbbr: string): Promise<PlayerInfo[]> {
  const cached = cache.get(teamAbbr);
  if (cached && cached.expires > Date.now()) return cached.data;

  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${teamAbbr.toLowerCase()}/roster`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const players: PlayerInfo[] = (data.athletes ?? []).map((a: any) => ({
      id: a.id ?? '',
      name: a.fullName ?? a.displayName ?? '',
      position: a.position?.abbreviation ?? '',
      jersey: a.jersey ?? '',
    }));
    /* eslint-enable @typescript-eslint/no-explicit-any */
    cache.set(teamAbbr, { data: players, expires: Date.now() + CACHE_TTL });
    return players;
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const teams = req.nextUrl.searchParams.get('teams') ?? '';
  if (!teams) {
    return NextResponse.json({ players: [] });
  }

  const abbrs = teams.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 2);
  const rosters = await Promise.all(abbrs.map(fetchRoster));

  const byTeam: Record<string, PlayerInfo[]> = {};
  for (let i = 0; i < abbrs.length; i++) {
    byTeam[abbrs[i]] = rosters[i];
  }

  return NextResponse.json({ byTeam });
}
