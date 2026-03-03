import { NextRequest, NextResponse } from 'next/server';
import { fetchAllGames, fetchGames } from '@/lib/espn';
import { Sport } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sport = req.nextUrl.searchParams.get('sport');
  const gameIds = req.nextUrl.searchParams.get('ids')?.split(',');

  try {
    const games =
      sport && sport !== 'all'
        ? await fetchGames(sport as Sport)
        : await fetchAllGames();

    // If specific game IDs requested, filter to just those
    const filtered = gameIds
      ? games.filter((g) => gameIds.includes(g.id))
      : games;

    return NextResponse.json({ games: filtered });
  } catch {
    return NextResponse.json({ games: [] }, { status: 500 });
  }
}
