import { NextRequest, NextResponse } from 'next/server';

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
  if (!id) {
    return NextResponse.json({ error: 'Missing player id' }, { status: 400 });
  }

  const cached = cache.get(id);
  if (cached && cached.expires > Date.now()) {
    return NextResponse.json({ averages: cached.data });
  }

  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${id}/stats`,
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

    cache.set(id, { data: averages, expires: Date.now() + CACHE_TTL });
    return NextResponse.json({ averages });
  } catch {
    return NextResponse.json({ averages: null });
  }
}
