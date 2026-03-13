import { NextResponse } from 'next/server';
import { firestore } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, runTransaction } from 'firebase/firestore';
import { fetchPlayerBoxScore, findPlayerStat, fetchGameById } from '@/lib/espn';

export async function POST(req: Request) {
  try {
    const { gameId, sport } = await req.json();

    if (!gameId) {
      return NextResponse.json({ error: 'Missing gameId' }, { status: 400 });
    }

    // Check if game is actually finished
    const gameInfo = await fetchGameById(gameId);
    if (!gameInfo || gameInfo.state !== 'post') {
      return NextResponse.json({ settled: 0, cancelled: 0, message: 'Game not finished' });
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

    // Fetch box score from ESPN once for all bets in this game
    const betSport = sport || betsSnap.docs[0]?.data()?.sport;
    const players = await fetchPlayerBoxScore(gameId, betSport);

    let settledCount = 0;
    let noStatCount = 0;

    for (const betDoc of betsSnap.docs) {
      const betRef = doc(firestore, 'bets', betDoc.id);

      try {
        let didSettle = false;
        await runTransaction(firestore, async (tx) => {
          const betSnap = await tx.get(betRef);
          if (!betSnap.exists()) return;

          const bet = betSnap.data();
          if (bet.status !== 'matched') return;

          // Look up the player's actual stat from ESPN box score
          const actualValue = findPlayerStat(players, bet.player, bet.stat);

          if (actualValue === null) {
            if (!bet.postDetectedAt) {
              // First time: stamp and wait for next cycle in case ESPN is delayed
              tx.update(betRef, { postDetectedAt: Date.now() });
              return;
            }
            // Already waited — settle as push (player DNP or not in game)
            didSettle = true;
            const creatorRef = doc(firestore, 'users', bet.creatorId);
            const takerRef = doc(firestore, 'users', bet.takerId);
            const cSnap = await tx.get(creatorRef);
            const tSnap = await tx.get(takerRef);
            if (cSnap.exists()) {
              tx.update(creatorRef, { coins: (cSnap.data().coins ?? 0) + bet.creatorStake });
            }
            if (tSnap.exists()) {
              tx.update(takerRef, { coins: (tSnap.data().coins ?? 0) + bet.takerStake });
            }
            tx.update(betRef, {
              status: 'settled',
              actualValue: null,
              actualDirection: null,
              result: 'push',
              autoSettled: true,
              settledAt: Date.now(),
              settleReason: 'player_not_found',
            });
            return;
          }

          didSettle = true;

          const isPush = actualValue === bet.target;
          const actualDirection = actualValue > bet.target ? 'over' : 'under';
          const creatorWins = !isPush && actualDirection === bet.direction;
          const totalPool = bet.creatorStake + bet.takerStake;

          const creatorRef = doc(firestore, 'users', bet.creatorId);
          const takerRef = doc(firestore, 'users', bet.takerId);

          if (isPush) {
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
            actualValue,
            actualDirection,
            result: isPush ? 'push' : (creatorWins ? 'creator_wins' : 'taker_wins'),
            autoSettled: true,
            settledAt: Date.now(),
          });
        });

        if (didSettle) settledCount++;
        else noStatCount++;
      } catch {
        // Individual bet transaction failed, continue with others
      }
    }

    return NextResponse.json({ settled: settledCount, cancelled: cancelledCount, noStat: noStatCount });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Auto-settle failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
