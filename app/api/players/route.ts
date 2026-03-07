import { NextRequest, NextResponse } from 'next/server';
import { SPORTS } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface PlayerInfo {
  id: string;
  name: string;
  position: string;
  jersey: string;
}

const cache = new Map<string, { data: PlayerInfo[]; expires: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function fetchRoster(teamAbbr: string, sport: string = 'nba'): Promise<PlayerInfo[]> {
  const cacheKey = `${sport}:${teamAbbr}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.data;

  const sportConfig = SPORTS.find((s) => s.key === sport);
  const espnPath = sportConfig?.espnPath ?? 'basketball/nba';

  try {
    // For NCAA, we need to search by team name since abbreviations don't work as IDs
    // Try the team abbreviation first, fall back to search
    let rosterUrl = `https://site.api.espn.com/apis/site/v2/sports/${espnPath}/teams/${teamAbbr.toLowerCase()}/roster`;

    const res = await fetch(rosterUrl, { next: { revalidate: 3600 } });
    if (!res.ok) {
      // For NCAA, try to find team ID via search
      if (sport === 'ncaam') {
        const searchRes = await fetch(
          `https://site.api.espn.com/apis/site/v2/sports/${espnPath}/teams?limit=1&search=${encodeURIComponent(teamAbbr)}`,
          { next: { revalidate: 3600 } }
        );
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          const teamId = searchData.sports?.[0]?.leagues?.[0]?.teams?.[0]?.team?.id;
          if (teamId) {
            rosterUrl = `https://site.api.espn.com/apis/site/v2/sports/${espnPath}/teams/${teamId}/roster`;
            const retryRes = await fetch(rosterUrl, { next: { revalidate: 3600 } });
            if (retryRes.ok) {
              const data = await retryRes.json();
              const players = parseRoster(data);
              cache.set(cacheKey, { data: players, expires: Date.now() + CACHE_TTL });
              return players;
            }
          }
        }
      }
      return [];
    }
    const data = await res.json();
    const players = parseRoster(data);
    cache.set(cacheKey, { data: players, expires: Date.now() + CACHE_TTL });
    return players;
  } catch {
    return [];
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function parseRoster(data: any): PlayerInfo[] {
  return (data.athletes ?? []).map((a: any) => ({
    id: a.id ?? '',
    name: a.fullName ?? a.displayName ?? '',
    position: a.position?.abbreviation ?? '',
    jersey: a.jersey ?? '',
  }));
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function GET(req: NextRequest) {
  const teams = req.nextUrl.searchParams.get('teams') ?? '';
  const displayTeams = req.nextUrl.searchParams.get('displayTeams') ?? '';
  const sport = req.nextUrl.searchParams.get('sport') ?? 'nba';
  if (!teams) {
    return NextResponse.json({ players: [] });
  }

  const fetchKeys = teams.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 2);
  const displayKeys = displayTeams
    ? displayTeams.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 2)
    : fetchKeys;
  const rosters = await Promise.all(fetchKeys.map((t) => fetchRoster(t, sport)));

  const byTeam: Record<string, PlayerInfo[]> = {};
  for (let i = 0; i < fetchKeys.length; i++) {
    byTeam[displayKeys[i] || fetchKeys[i]] = rosters[i];
  }

  return NextResponse.json({ byTeam }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
