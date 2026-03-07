import { NextResponse } from 'next/server';
import { fetchTournamentTeams } from '@/lib/espn';

export async function GET() {
  try {
    const teams = await fetchTournamentTeams();
    return NextResponse.json({ teams }, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch {
    return NextResponse.json({ teams: [] }, { status: 500 });
  }
}
