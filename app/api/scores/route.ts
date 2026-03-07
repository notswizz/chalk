import { NextRequest, NextResponse } from 'next/server';
import { fetchAllGames, fetchGames, fetchGameById } from '@/lib/espn';
import { Sport } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sport = req.nextUrl.searchParams.get('sport');
  const gameIds = req.nextUrl.searchParams.get('ids')?.split(',').filter(Boolean);

  try {
    // If specific game IDs requested, fetch them directly
    if (gameIds && gameIds.length > 0) {
      const results = await Promise.all(gameIds.map(fetchGameById));
      const games = results.filter((g) => g !== null);
      return NextResponse.json({ games });
    }

    const games =
      sport && sport !== 'all'
        ? await fetchGames(sport as Sport)
        : await fetchAllGames();

    return NextResponse.json({ games });
  } catch {
    return NextResponse.json({ games: [] }, { status: 500 });
  }
}
