import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { firestore } from '@/lib/firebase';
import { doc, collection, runTransaction } from 'firebase/firestore';
import { ensureUserDoc } from '@/lib/ensure-user';
import { calculateOppositeOdds, calculateTakerStake, isValidAmericanOdds } from '@/lib/odds';
import { ROUND_ORDER, TournamentRound } from '@/lib/types';
import { trackChallenge } from '@/lib/track-challenge';

export async function POST(req: Request) {
  try {
    const userId = await verifyAuth(req);
    const body = await req.json();
    const { teamId, teamName, teamSeed, teamLogo, round, direction, odds, stake } = body;

    if (!teamId || !teamName || !round || !direction || !odds || !stake) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!isValidAmericanOdds(odds)) {
      return NextResponse.json({ error: 'Invalid odds' }, { status: 400 });
    }

    if (!ROUND_ORDER.includes(round as TournamentRound)) {
      return NextResponse.json({ error: 'Invalid round' }, { status: 400 });
    }

    if (direction !== 'WILL' && direction !== 'WILL_NOT') {
      return NextResponse.json({ error: 'Invalid direction' }, { status: 400 });
    }

    if (stake <= 0) {
      return NextResponse.json({ error: 'Invalid stake' }, { status: 400 });
    }

    const oppositeOdds = calculateOppositeOdds(odds);
    const takerStake = calculateTakerStake(stake, odds);

    const betRef = doc(collection(firestore, 'bets'));
    const userRef = doc(firestore, 'users', userId);

    await ensureUserDoc(userId);

    await runTransaction(firestore, async (tx) => {
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists()) throw new Error('User not found');

      const userData = userSnap.data();
      if (userData.coins < stake) throw new Error('Insufficient coins');

      tx.update(userRef, {
        coins: userData.coins - stake,
        totalBetsCreated: (userData.totalBetsCreated ?? 0) + 1,
      });

      tx.set(betRef, {
        type: 'tournament',
        creatorId: userId,
        creatorName: userData.displayName || 'Anonymous',
        takerId: null,
        takerName: null,
        teamId,
        teamName,
        teamSeed: Number(teamSeed) || 0,
        teamLogo: teamLogo || '',
        round,
        direction,
        odds,
        oppositeOdds,
        stake,
        creatorStake: stake,
        takerStake,
        status: 'open',
        createdAt: Date.now(),
        matchedAt: null,
      });
    });

    trackChallenge(userId, 'bet_placed', { stake, sport: 'ncaam' }).catch(() => {});
    trackChallenge(userId, 'tournament_prop').catch(() => {});

    return NextResponse.json({ id: betRef.id, takerStake });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to create tournament prop';
    const status = message.includes('Unauthorized') || message.includes('token') ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
