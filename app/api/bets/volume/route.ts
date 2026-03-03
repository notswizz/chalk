import { NextResponse } from 'next/server';
import { firestore } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const gameIds = searchParams.get('gameIds')?.split(',').filter(Boolean) ?? [];

    if (gameIds.length === 0) {
      return NextResponse.json({ volumes: {} });
    }

    // Firestore 'in' queries limited to 30 items
    const chunks: string[][] = [];
    for (let i = 0; i < gameIds.length; i += 30) {
      chunks.push(gameIds.slice(i, i + 30));
    }

    const volumes: Record<string, { wagered: number; pending: number; total: number; betCount: number }> = {};
    let totalBetCount = 0;
    let totalChalk = 0;

    for (const chunk of chunks) {
      const q = query(
        collection(firestore, 'bets'),
        where('gameId', 'in', chunk),
      );
      const snap = await getDocs(q);

      for (const d of snap.docs) {
        const bet = d.data();
        if (bet.status === 'cancelled') continue;

        const gid = bet.gameId as string;
        if (!volumes[gid]) volumes[gid] = { wagered: 0, pending: 0, total: 0, betCount: 0 };

        const pool = (bet.creatorStake ?? 0) + (bet.takerStake ?? 0);
        volumes[gid].betCount++;
        totalBetCount++;

        if (bet.status === 'matched' || bet.status === 'settled') {
          volumes[gid].wagered += pool;
        } else if (bet.status === 'open') {
          volumes[gid].pending += pool;
        }
      }
    }

    // Calculate totals
    for (const gid of Object.keys(volumes)) {
      volumes[gid].total = volumes[gid].wagered + volumes[gid].pending;
      totalChalk += volumes[gid].total;
    }

    return NextResponse.json({ volumes, totalBetCount, totalChalk });
  } catch {
    return NextResponse.json({ volumes: {} });
  }
}
