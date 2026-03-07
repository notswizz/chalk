import { NextResponse } from 'next/server';
import { firestore } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status'); // 'open' | 'matched' | null (all)
  const type = searchParams.get('type'); // 'tournament' | null

  const constraints = [];

  if (status) {
    constraints.push(where('status', '==', status));
  } else {
    constraints.push(where('status', 'in', ['open', 'matched']));
  }

  if (type === 'tournament') {
    constraints.push(where('type', '==', 'tournament'));
  }

  const q = query(collection(firestore, 'bets'), ...constraints);
  const snapshot = await getDocs(q);
  const bets = snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown>))
    .sort((a, b) => (b.createdAt as number) - (a.createdAt as number));

  return NextResponse.json({ bets });
}
