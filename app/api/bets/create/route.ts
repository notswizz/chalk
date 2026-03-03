import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { firestore } from '@/lib/firebase';
import { doc, collection, runTransaction } from 'firebase/firestore';
import { ensureUserDoc } from '@/lib/ensure-user';

export async function POST(req: Request) {
  try {
    const userId = await verifyAuth(req);
    const body = await req.json();
    const { gameId, gameTitle, gameDate, player, stat, target, direction, stake, odds } = body;

    if (!gameId || !player || !stat || !target || !direction || !stake || !odds) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (stake <= 0 || odds <= 0) {
      return NextResponse.json({ error: 'Invalid stake or odds' }, { status: 400 });
    }

    const takerStake = Math.round(stake * odds);
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
        creatorId: userId,
        creatorName: userData.displayName || 'Anonymous',
        takerId: null,
        takerName: null,
        gameId,
        gameTitle: gameTitle || '',
        gameDate: gameDate || '',
        player,
        stat,
        target: Number(target),
        direction,
        creatorStake: stake,
        takerStake,
        odds,
        status: 'open',
        createdAt: Date.now(),
        matchedAt: null,
        expiresAt: null,
      });
    });

    return NextResponse.json({ id: betRef.id, takerStake });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to create bet';
    const status = message.includes('Unauthorized') || message.includes('token') ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
