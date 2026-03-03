import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { firestore } from '@/lib/firebase';
import { doc, runTransaction } from 'firebase/firestore';

export async function POST(req: Request) {
  try {
    const userId = await verifyAuth(req);
    const { betId } = await req.json();

    if (!betId) {
      return NextResponse.json({ error: 'Missing betId' }, { status: 400 });
    }

    const betRef = doc(firestore, 'bets', betId);

    await runTransaction(firestore, async (tx) => {
      const betSnap = await tx.get(betRef);
      if (!betSnap.exists()) throw new Error('Bet not found');

      const bet = betSnap.data();
      if (bet.status !== 'open') throw new Error('Bet is not open');
      if (bet.creatorId !== userId) throw new Error('Not your bet');

      const userRef = doc(firestore, 'users', userId);
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists()) throw new Error('User not found');

      tx.update(userRef, {
        coins: userSnap.data().coins + bet.creatorStake,
      });

      tx.update(betRef, { status: 'cancelled' });
    });

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to cancel bet';
    const status = message.includes('Unauthorized') || message.includes('token') ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
