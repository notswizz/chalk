import { NextRequest, NextResponse } from 'next/server';
import { fetchPlayerBoxScore } from '@/lib/espn';

// Cache for 30 seconds to avoid hammering ESPN
const cache = new Map<string, { data: Record<string, Record<string, number>>; expires: number }>();
const CACHE_TTL = 30 * 1000;

export async function GET(req: NextRequest) {
  const gameId = req.nextUrl.searchParams.get('gameId');
  const sport = req.nextUrl.searchParams.get('sport') || undefined;

  if (!gameId) {
    return NextResponse.json({ error: 'gameId required' }, { status: 400 });
  }

  const cacheKey = `${gameId}:${sport || 'nba'}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return NextResponse.json({ stats: cached.data });
  }

  try {
    const players = await fetchPlayerBoxScore(gameId, sport);
    const stats: Record<string, Record<string, number>> = {};
    for (const p of players) {
      stats[p.name.toLowerCase()] = p.stats;
    }

    cache.set(cacheKey, { data: stats, expires: Date.now() + CACHE_TTL });
    return NextResponse.json({ stats });
  } catch {
    return NextResponse.json({ stats: {} });
  }
}
