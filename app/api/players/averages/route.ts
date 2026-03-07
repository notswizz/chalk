import { NextRequest, NextResponse } from 'next/server';
import { SPORTS } from '@/lib/types';

interface SeasonAverages {
  points: number;
  rebounds: number;
  assists: number;
  threes: number;
  season: string;
}

const cache = new Map<string, { data: SeasonAverages; expires: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  const sport = req.nextUrl.searchParams.get('sport') ?? 'nba';
  if (!id) {
    return NextResponse.json({ error: 'Missing player id' }, { status: 400 });
  }

  const cacheKey = `${sport}:${id}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return NextResponse.json({ averages: cached.data });
  }

  const sportConfig = SPORTS.find((s) => s.key === sport);
  const espnPath = sportConfig?.espnPath ?? 'basketball/nba';

  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/common/v3/sports/${espnPath}/athletes/${id}/stats`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) {
      return NextResponse.json({ averages: null });
    }

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const data = await res.json();
    const avgCat = (data.categories ?? []).find((c: any) => c.name === 'averages');
    if (!avgCat || !avgCat.statistics?.length) {
      return NextResponse.json({ averages: null });
    }

    const labels: string[] = avgCat.labels ?? [];
    const currentSeason = avgCat.statistics[avgCat.statistics.length - 1];
    const stats: string[] = currentSeason.stats ?? [];

    const statsMap: Record<string, string> = {};
    labels.forEach((label: string, i: number) => {
      statsMap[label] = stats[i] ?? '0';
    });

    const averages: SeasonAverages = {
      points: parseFloat(statsMap['PTS']) || 0,
      rebounds: parseFloat(statsMap['REB']) || 0,
      assists: parseFloat(statsMap['AST']) || 0,
      threes: parseFloat((statsMap['3PT'] ?? '0').split('-')[0]) || 0,
      season: currentSeason.season?.displayName ?? '',
    };
    /* eslint-enable @typescript-eslint/no-explicit-any */

    cache.set(cacheKey, { data: averages, expires: Date.now() + CACHE_TTL });
    return NextResponse.json({ averages });
  } catch {
    return NextResponse.json({ averages: null });
  }
}
