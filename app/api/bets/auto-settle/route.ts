import { NextResponse } from 'next/server';
import { firestore } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, runTransaction } from 'firebase/firestore';

const AUTO_SETTLE_DELAY_MS = 30 * 60 * 1000; // 30 minutes

interface Validation {
  userId: string;
  actualValue: number;
  timestamp: number;
}

export async function POST(req: Request) {
  try {
    const { gameId } = await req.json();

    if (!gameId) {
      return NextResponse.json({ error: 'Missing gameId' }, { status: 400 });
    }

    // Cancel open (unmatched) bets for this game — refund creator
    const openQuery = query(
      collection(firestore, 'bets'),
      where('gameId', '==', gameId),
      where('status', '==', 'open')
    );
    const openSnap = await getDocs(openQuery);
    let cancelledCount = 0;

    for (const betDoc of openSnap.docs) {
      const betRef = doc(firestore, 'bets', betDoc.id);
      try {
        await runTransaction(firestore, async (tx) => {
          const betSnap = await tx.get(betRef);
          if (!betSnap.exists()) return;
          const bet = betSnap.data();
          if (bet.status !== 'open') return;

          // Refund creator
          const creatorRef = doc(firestore, 'users', bet.creatorId);
          const creatorSnap = await tx.get(creatorRef);
          if (creatorSnap.exists()) {
            tx.update(creatorRef, { coins: (creatorSnap.data().coins ?? 0) + bet.creatorStake });
          }

          tx.update(betRef, {
            status: 'cancelled',
            cancelReason: 'game_ended',
            cancelledAt: Date.now(),
          });
        });
        cancelledCount++;
      } catch {
        // Individual cancel failed, continue
      }
    }

    // Find all matched bets for this game
    const betsQuery = query(
      collection(firestore, 'bets'),
      where('gameId', '==', gameId),
      where('status', '==', 'matched')
    );
    const betsSnap = await getDocs(betsQuery);

    if (betsSnap.empty && cancelledCount === 0) {
      return NextResponse.json({ settled: 0, cancelled: 0 });
    }

    let settledCount = 0;

    for (const betDoc of betsSnap.docs) {
      const betRef = doc(firestore, 'bets', betDoc.id);

      try {
        let didSettle = false;
        await runTransaction(firestore, async (tx) => {
          const betSnap = await tx.get(betRef);
          if (!betSnap.exists()) return;

          const bet = betSnap.data();
          if (bet.status !== 'matched') return; // already settled

          // Stamp when we first detected the game ended; use that for the delay
          if (!bet.postDetectedAt) {
            tx.update(betRef, { postDetectedAt: Date.now() });
            return;
          }

          if (Date.now() - bet.postDetectedAt < AUTO_SETTLE_DELAY_MS) {
            return;
          }

          didSettle = true;
          const validations: Validation[] = bet.validations ?? [];

          if (validations.length === 0) {
            // No validations — refund both sides (push)
            const creatorRef = doc(firestore, 'users', bet.creatorId);
            const takerRef = doc(firestore, 'users', bet.takerId);
            const creatorSnap = await tx.get(creatorRef);
            const takerSnap = await tx.get(takerRef);
            if (creatorSnap.exists()) {
              tx.update(creatorRef, { coins: (creatorSnap.data().coins ?? 0) + bet.creatorStake });
            }
            if (takerSnap.exists()) {
              tx.update(takerRef, { coins: (takerSnap.data().coins ?? 0) + bet.takerStake });
            }

            tx.update(betRef, {
              status: 'settled',
              result: 'push',
              autoSettled: true,
              settledAt: Date.now(),
            });
          } else {
            // Pick mode (most common actualValue), tie-break by earliest timestamp
            const valueCounts: Record<number, { count: number; earliest: number }> = {};
            for (const v of validations) {
              const existing = valueCounts[v.actualValue];
              if (existing) {
                existing.count++;
                if (v.timestamp < existing.earliest) existing.earliest = v.timestamp;
              } else {
                valueCounts[v.actualValue] = { count: 1, earliest: v.timestamp };
              }
            }

            let bestValue = 0;
            let bestCount = 0;
            let bestEarliest = Infinity;
            for (const [val, info] of Object.entries(valueCounts)) {
              if (
                info.count > bestCount ||
                (info.count === bestCount && info.earliest < bestEarliest)
              ) {
                bestValue = Number(val);
                bestCount = info.count;
                bestEarliest = info.earliest;
              }
            }

            const settledValue = bestValue;
            const isPush = settledValue === bet.target;
            const actualDirection = settledValue > bet.target ? 'over' : 'under';
            const creatorWins = !isPush && actualDirection === bet.direction;
            const totalPool = bet.creatorStake + bet.takerStake;

            if (isPush) {
              const creatorRef = doc(firestore, 'users', bet.creatorId);
              const takerRef = doc(firestore, 'users', bet.takerId);
              const creatorSnap = await tx.get(creatorRef);
              const takerSnap = await tx.get(takerRef);
              if (creatorSnap.exists()) {
                tx.update(creatorRef, { coins: (creatorSnap.data().coins ?? 0) + bet.creatorStake });
              }
              if (takerSnap.exists()) {
                tx.update(takerRef, { coins: (takerSnap.data().coins ?? 0) + bet.takerStake });
              }
            } else {
              const winnerId = creatorWins ? bet.creatorId : bet.takerId;
              const winnerRef = doc(firestore, 'users', winnerId);
              const winnerSnap = await tx.get(winnerRef);
              if (winnerSnap.exists()) {
                tx.update(winnerRef, { coins: (winnerSnap.data().coins ?? 0) + totalPool });
              }
            }

            tx.update(betRef, {
              status: 'settled',
              validations,
              actualValue: settledValue,
              actualDirection,
              result: isPush ? 'push' : (creatorWins ? 'creator_wins' : 'taker_wins'),
              autoSettled: true,
              settledAt: Date.now(),
            });
          }
        });

        if (didSettle) settledCount++;
      } catch {
        // Individual bet transaction failed, continue with others
      }
    }

    return NextResponse.json({ settled: settledCount, cancelled: cancelledCount });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Auto-settle failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
