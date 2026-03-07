import { NextResponse } from 'next/server';
import { firestore } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, runTransaction } from 'firebase/firestore';
import { calculatePayout } from '@/lib/odds';
import { ROUND_ORDER } from '@/lib/types';

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports';

function detectRound(event: any): string {
  const headline: string = event.competitions?.[0]?.notes?.[0]?.headline || '';
  if (headline.includes('First Round')) return 'round_of_64';
  if (headline.includes('Second Round')) return 'round_of_32';
  if (headline.includes('Sweet 16')) return 'sweet_16';
  if (headline.includes('Elite Eight') || headline.includes('Elite 8')) return 'elite_eight';
  if (headline.includes('Final Four')) return 'final_four';
  if (headline.includes('National Championship') || headline.includes('Championship')) return 'championship';
  return 'unknown';
}

function didTeamReachRound(eliminatedAt: string, targetRound: string): boolean {
  const elimIndex = ROUND_ORDER.indexOf(eliminatedAt as any);
  const targetIndex = ROUND_ORDER.indexOf(targetRound as any);
  if (elimIndex === -1 || targetIndex === -1) return false;
  // Team "reached" a round if eliminated AT or AFTER that round
  return elimIndex >= targetIndex;
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Fetch current tournament scoreboard from ESPN
    const now = new Date();
    const year = now.getFullYear();
    const res = await fetch(
      `${ESPN_BASE}/basketball/mens-college-basketball/scoreboard?dates=${year}0301-${year}0410&limit=100`,
      { cache: 'no-store' }
    );
    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch ESPN data' }, { status: 500 });
    }
    const data = await res.json();

    // Build map of eliminated teams from completed tournament games
    const eliminatedTeams = new Map<string, string>(); // teamId -> round eliminated

    for (const event of data.events || []) {
      const competition = event.competitions?.[0];
      if (!competition?.status?.type?.completed) continue;
      const round = detectRound(event);
      if (round === 'unknown') continue;

      for (const competitor of competition.competitors || []) {
        if (competitor.winner === false) {
          eliminatedTeams.set(competitor.team.id, round);
        }
      }
    }

    // Find all matched tournament props
    const propsQuery = query(
      collection(firestore, 'bets'),
      where('type', '==', 'tournament'),
      where('status', '==', 'matched')
    );
    const propsSnap = await getDocs(propsQuery);

    let settled = 0;

    for (const betDoc of propsSnap.docs) {
      const prop = betDoc.data();
      const teamElimRound = eliminatedTeams.get(prop.teamId);

      if (!teamElimRound) continue; // Team still alive, skip

      const madeIt = didTeamReachRound(teamElimRound, prop.round);

      // WILL: creator bet team WILL reach round
      // WILL_NOT: creator bet team WILL NOT reach round
      let creatorWon: boolean;
      if (prop.direction === 'WILL') {
        creatorWon = madeIt;
      } else {
        creatorWon = !madeIt;
      }

      const winnerId = creatorWon ? prop.creatorId : prop.takerId;
      const winnerStake = creatorWon ? prop.stake : prop.takerStake;
      const winnerOdds = creatorWon ? prop.odds : prop.oppositeOdds;
      const winnings = calculatePayout(winnerStake, winnerOdds);

      const betRef = doc(firestore, 'bets', betDoc.id);
      const winnerRef = doc(firestore, 'users', winnerId);

      await runTransaction(firestore, async (tx) => {
        const winnerDoc = await tx.get(winnerRef);
        const currentCoins = winnerDoc.data()?.coins || 0;

        // Winner gets their stake back + winnings
        tx.update(winnerRef, {
          coins: currentCoins + winnerStake + winnings,
        });

        tx.update(betRef, {
          status: creatorWon ? 'won' : 'lost',
          settledAt: Date.now(),
          settledRound: teamElimRound,
        });
      });

      settled++;
    }

    return NextResponse.json({
      settled,
      eliminatedTeams: [...eliminatedTeams.entries()],
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Settlement failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
