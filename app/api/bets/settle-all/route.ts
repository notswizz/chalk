import { NextResponse } from 'next/server';
import { firestore } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, runTransaction } from 'firebase/firestore';
import { fetchPlayerBoxScore, findPlayerStat, fetchGameById } from '@/lib/espn';
import { trackChallenge } from '@/lib/track-challenge';

const CHALKBOT_ID = 'system:chalk-props';

/** Credit coins to a user. For ChalkBot, creates the doc if it doesn't exist. */
async function creditUser(tx: Parameters<Parameters<typeof runTransaction>[1]>[0], userId: string, amount: number) {
  const ref = doc(firestore, 'users', userId);
  const snap = await tx.get(ref);
  if (snap.exists()) {
    tx.update(ref, { coins: (snap.data().coins ?? 0) + amount });
  } else if (userId === CHALKBOT_ID) {
    tx.set(ref, { coins: amount, displayName: 'ChalkBot', createdAt: Date.now() });
  }
}

/**
 * Settle ALL unsettled bets across all games.
 * Finds every matched/open bet, groups by gameId, fetches ESPN box scores,
 * and grades them. Designed to be called by Vercel Cron.
 */
export async function GET(req: Request) {
  // Verify cron secret if set (Vercel sends this header for cron jobs)
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Find all matched bets that haven't been settled
    const matchedQuery = query(
      collection(firestore, 'bets'),
      where('status', '==', 'matched')
    );
    const matchedSnap = await getDocs(matchedQuery);

    // 2. Find all open bets (should be cancelled if game ended)
    const openQuery = query(
      collection(firestore, 'bets'),
      where('status', '==', 'open')
    );
    const openSnap = await getDocs(openQuery);

    // 3. Collect unique game IDs and their sport
    const gameIds = new Set<string>();
    const gameSport = new Map<string, string>();
    for (const d of matchedSnap.docs) {
      const data = d.data();
      if (!data.gameId || data.type === 'tournament') continue;
      gameIds.add(data.gameId);
      if (data.sport) gameSport.set(data.gameId, data.sport);
    }
    for (const d of openSnap.docs) {
      const data = d.data();
      if (!data.gameId || data.type === 'tournament') continue;
      gameIds.add(data.gameId);
      if (data.sport) gameSport.set(data.gameId, data.sport);
    }

    if (gameIds.size === 0) {
      return NextResponse.json({ message: 'No pending bets', settled: 0, cancelled: 0, noStat: 0, games: 0 });
    }

    let totalSettled = 0;
    let totalCancelled = 0;
    let totalNoStat = 0;
    const results: Record<string, { settled: number; cancelled: number; noStat: number }> = {};

    // 4. Process each game
    for (const gameId of gameIds) {
      let settled = 0;
      let cancelled = 0;
      let noStat = 0;

      // Check if game is actually finished via ESPN game state
      const sport = gameSport.get(gameId);
      const gameInfo = await fetchGameById(gameId);
      const gameFinished = gameInfo?.state === 'post';
      const players = gameFinished ? await fetchPlayerBoxScore(gameId, sport) : [];

      if (gameFinished) {
        // Cancel open bets for finished games
        const gameOpenQuery = query(
          collection(firestore, 'bets'),
          where('gameId', '==', gameId),
          where('status', '==', 'open')
        );
        const gameOpenSnap = await getDocs(gameOpenQuery);

        for (const betDoc of gameOpenSnap.docs) {
          const betRef = doc(firestore, 'bets', betDoc.id);
          try {
            await runTransaction(firestore, async (tx) => {
              const betSnap = await tx.get(betRef);
              if (!betSnap.exists()) return;
              const bet = betSnap.data();
              if (bet.status !== 'open') return;

              // Never refund ChalkBot — only credit, never debit
              if (bet.creatorId !== CHALKBOT_ID) {
                const creatorRef = doc(firestore, 'users', bet.creatorId);
                const creatorSnap = await tx.get(creatorRef);
                if (creatorSnap.exists()) {
                  tx.update(creatorRef, { coins: (creatorSnap.data().coins ?? 0) + bet.creatorStake });
                }
              }
              tx.update(betRef, {
                status: 'cancelled',
                cancelReason: 'game_ended',
                cancelledAt: Date.now(),
              });
            });
            cancelled++;
          } catch { /* continue */ }
        }

        // Settle matched bets for finished games
        const gameMatchedQuery = query(
          collection(firestore, 'bets'),
          where('gameId', '==', gameId),
          where('status', '==', 'matched')
        );
        const gameMatchedSnap = await getDocs(gameMatchedQuery);

        for (const betDoc of gameMatchedSnap.docs) {
          const betRef = doc(firestore, 'bets', betDoc.id);
          try {
            let didSettle = false;
            let settleResult: { winnerId: string; loserId: string; profit: number } | null = null;
            await runTransaction(firestore, async (tx) => {
              const betSnap = await tx.get(betRef);
              if (!betSnap.exists()) return;
              const bet = betSnap.data();
              if (bet.status !== 'matched') return;

              const actualValue = findPlayerStat(players, bet.player, bet.stat);

              // Player not found (DNP or wrong game) — push after first detection
              if (actualValue === null) {
                if (!bet.postDetectedAt) {
                  // First time: stamp and wait for next cycle in case ESPN is delayed
                  tx.update(betRef, { postDetectedAt: Date.now() });
                  return;
                }
                // Already waited — settle as push (refund both sides, skip ChalkBot)
                didSettle = true;
                const isChalkBotBet = bet.creatorId === CHALKBOT_ID;
                if (!isChalkBotBet) {
                  await creditUser(tx, bet.creatorId, bet.creatorStake);
                }
                await creditUser(tx, bet.takerId, bet.takerStake);
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
              const isChalkBotBet = bet.creatorId === CHALKBOT_ID;

              if (isPush) {
                // Refund both sides — skip ChalkBot (never debit)
                if (!isChalkBotBet) {
                  await creditUser(tx, bet.creatorId, bet.creatorStake);
                }
                await creditUser(tx, bet.takerId, bet.takerStake);
              } else {
                const winnerId = creatorWins ? bet.creatorId : bet.takerId;
                const loserId = creatorWins ? bet.takerId : bet.creatorId;
                const winnerStake = creatorWins ? bet.creatorStake : bet.takerStake;
                // Always pay winner full pool (mints tokens when winning vs ChalkBot)
                await creditUser(tx, winnerId, totalPool);
                settleResult = { winnerId, loserId, profit: totalPool - winnerStake };
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

            if (didSettle) {
              settled++;
              if (settleResult) {
                const { winnerId, loserId, profit } = settleResult;
                trackChallenge(winnerId, 'bet_won', { profit }).catch(() => {});
                trackChallenge(loserId, 'bet_lost').catch(() => {});
              }
            }
            else noStat++;
          } catch { /* continue */ }
        }
      }

      results[gameId] = { settled, cancelled, noStat };
      totalSettled += settled;
      totalCancelled += cancelled;
      totalNoStat += noStat;
    }

    return NextResponse.json({
      settled: totalSettled,
      cancelled: totalCancelled,
      noStat: totalNoStat,
      games: gameIds.size,
      details: results,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Settle-all failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
