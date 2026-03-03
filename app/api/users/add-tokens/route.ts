import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { firestore } from '@/lib/firebase';
import { doc, runTransaction } from 'firebase/firestore';
import { ensureUserDoc } from '@/lib/ensure-user';

const ALLOWED_AMOUNTS = [100, 250, 500, 1000];

export async function POST(req: Request) {
  try {
    const userId = await verifyAuth(req);
    const { amount } = await req.json();

    if (!ALLOWED_AMOUNTS.includes(amount)) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    const userRef = doc(firestore, 'users', userId);
    await ensureUserDoc(userId);
    const newCoins = await runTransaction(firestore, async (tx) => {
      const snap = await tx.get(userRef);
      if (!snap.exists()) throw new Error('User not found');
      const updated = (snap.data().coins ?? 0) + amount;
      tx.update(userRef, { coins: updated });
      return updated;
    });

    return NextResponse.json({ coins: newCoins });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unauthorized';
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
