import { NextRequest, NextResponse } from 'next/server';
import { fetchGameById } from '@/lib/espn';
import { findStreams } from '@/lib/sources';

// Simple in-memory cache
const cache = new Map<string, { data: unknown; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;

  // Check cache
  const cached = cache.get(gameId);
  if (cached && cached.expires > Date.now()) {
    return NextResponse.json(cached.data);
  }

  try {
    const game = await fetchGameById(gameId);
    if (!game) {
      return NextResponse.json({ streams: [] }, { status: 404 });
    }

    const streams = await findStreams(
      game.sport,
      game.awayTeam.displayName,
      game.homeTeam.displayName,
      gameId
    );

    const responseData = { streams, game };

    // Cache the result
    cache.set(gameId, { data: responseData, expires: Date.now() + CACHE_TTL });

    return NextResponse.json(responseData);
  } catch {
    return NextResponse.json({ streams: [] }, { status: 500 });
  }
}
