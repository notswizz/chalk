import { NextResponse } from 'next/server';
import { firestore } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;

  const q = query(
    collection(firestore, 'bets'),
    where('gameId', '==', gameId)
  );

  const snapshot = await getDocs(q);
  const all = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown>));
  const bets = all
    .filter((b) => b.status === 'open' || b.status === 'matched')
    .sort((a, b) => (b.createdAt as number) - (a.createdAt as number));

  return NextResponse.json({ bets });
}
