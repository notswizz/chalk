import { NextRequest, NextResponse } from 'next/server';
import { fetchAllGames, fetchGames } from '@/lib/espn';
import { Sport } from '@/lib/types';

export async function GET(req: NextRequest) {
  const sport = req.nextUrl.searchParams.get('sport');

  try {
    const games =
      sport && sport !== 'all'
        ? await fetchGames(sport as Sport)
        : await fetchAllGames();

    return NextResponse.json({ games }, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    });
  } catch {
    return NextResponse.json({ games: [] }, { status: 500 });
  }
}
