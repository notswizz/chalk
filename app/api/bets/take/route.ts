import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { firestore } from '@/lib/firebase';
import { doc, runTransaction } from 'firebase/firestore';
import { ensureUserDoc } from '@/lib/ensure-user';
import { trackChallenge } from '@/lib/track-challenge';

export async function POST(req: Request) {
  try {
    const userId = await verifyAuth(req);
    const { betId } = await req.json();

    if (!betId) {
      return NextResponse.json({ error: 'Missing betId' }, { status: 400 });
    }

    const betRef = doc(firestore, 'bets', betId);
    const userRef = doc(firestore, 'users', userId);

    await ensureUserDoc(userId);

    let betSport = 'nba';
    let betStake = 0;

    await runTransaction(firestore, async (tx) => {
      const betSnap = await tx.get(betRef);
      if (!betSnap.exists()) throw new Error('Bet not found');

      const bet = betSnap.data();
      if (bet.status !== 'open') throw new Error('Bet is no longer open');
      if (bet.creatorId === userId) throw new Error('Cannot take your own bet');

      betSport = bet.sport || 'nba';
      betStake = bet.takerStake;

      const userSnap = await tx.get(userRef);
      if (!userSnap.exists()) throw new Error('User not found');

      const userData = userSnap.data();
      if (userData.coins < bet.takerStake) throw new Error('Insufficient coins');

      tx.update(userRef, {
        coins: userData.coins - bet.takerStake,
        totalBetsTaken: (userData.totalBetsTaken ?? 0) + 1,
      });

      tx.update(betRef, {
        takerId: userId,
        takerName: userData.displayName || 'Anonymous',
        status: 'matched',
        matchedAt: Date.now(),
      });
    });

    trackChallenge(userId, 'bet_placed', { stake: betStake, sport: betSport }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to take bet';
    const status = message.includes('Unauthorized') || message.includes('token') ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
