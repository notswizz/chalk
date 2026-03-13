import { NextRequest, NextResponse } from 'next/server';
import { fetchAllGames, fetchGames, fetchTournamentGames } from '@/lib/espn';
import { Sport } from '@/lib/types';
import { settleFinishedGames } from '@/lib/settle';

export async function GET(req: NextRequest) {
  const sport = req.nextUrl.searchParams.get('sport');
  const tournament = req.nextUrl.searchParams.get('tournament');

  try {
    // NCAA tournament mode — fetch expanded date range with round info
    if (sport === 'ncaam' && tournament === '1') {
      const { games, roundMap } = await fetchTournamentGames();
      // Fire-and-forget: settle any finished games in background
      settleFinishedGames(games.filter((g) => g.state === 'post')).catch(() => {});
      return NextResponse.json({ games, roundMap }, {
        headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
      });
    }

    const games =
      sport && sport !== 'all'
        ? await fetchGames(sport as Sport)
        : await fetchAllGames();

    // Fire-and-forget: settle any finished games in background
    settleFinishedGames(games.filter((g) => g.state === 'post')).catch(() => {});

    return NextResponse.json({ games }, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    });
  } catch {
    return NextResponse.json({ games: [] }, { status: 500 });
  }
}
