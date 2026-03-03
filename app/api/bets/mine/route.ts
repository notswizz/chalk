import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { firestore } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export async function GET(req: Request) {
  try {
    const userId = await verifyAuth(req);

    const [createdSnap, takenSnap] = await Promise.all([
      getDocs(query(collection(firestore, 'bets'), where('creatorId', '==', userId))),
      getDocs(query(collection(firestore, 'bets'), where('takerId', '==', userId))),
    ]);

    const betsMap = new Map<string, Record<string, unknown>>();
    for (const d of createdSnap.docs) {
      betsMap.set(d.id, { id: d.id, ...d.data() });
    }
    for (const d of takenSnap.docs) {
      betsMap.set(d.id, { id: d.id, ...d.data() });
    }

    const bets = Array.from(betsMap.values()).sort(
      (a, b) => (b.createdAt as number) - (a.createdAt as number)
    );

    return NextResponse.json({ bets });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unauthorized';
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
