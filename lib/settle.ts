import { firestore } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, runTransaction } from 'firebase/firestore';
import { fetchPlayerBoxScore, findPlayerStat } from '@/lib/espn';
import { trackChallenge } from '@/lib/track-challenge';
import { Game } from '@/lib/types';

// Throttle: don't re-settle a game within 60s
const recentlySettled = new Map<string, number>();
const SETTLE_COOLDOWN = 60_000;

/**
 * Settle bets for a list of finished games.
 * Designed to be called fire-and-forget from high-traffic endpoints.
 */
export async function settleFinishedGames(finishedGames: Game[]) {
  const now = Date.now();
  const toSettle = finishedGames.filter((g) => {
    const last = recentlySettled.get(g.id);
    return !last || now - last > SETTLE_COOLDOWN;
  });

  if (toSettle.length === 0) return;

  for (const game of toSettle) {
    recentlySettled.set(game.id, now);
    settleGame(game.id, game.sport).catch(() => {});
  }
}

/**
 * Settle all bets for a single finished game.
 */
export async function settleGame(gameId: string, sport?: string) {
  // Cancel open bets
  const openSnap = await getDocs(
    query(collection(firestore, 'bets'), where('gameId', '==', gameId), where('status', '==', 'open'))
  );

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
    } catch { /* continue */ }
  }

  // Settle matched bets
  const matchedSnap = await getDocs(
    query(collection(firestore, 'bets'), where('gameId', '==', gameId), where('status', '==', 'matched'))
  );

  if (matchedSnap.empty) return;

  const betSport = sport || matchedSnap.docs[0]?.data()?.sport;
  const players = await fetchPlayerBoxScore(gameId, betSport);

  for (const betDoc of matchedSnap.docs) {
    const betRef = doc(firestore, 'bets', betDoc.id);
    try {
      let settleResult: { winnerId: string; loserId: string; profit: number } | null = null;
      let didSettle = false;

      await runTransaction(firestore, async (tx) => {
        const betSnap = await tx.get(betRef);
        if (!betSnap.exists()) return;
        const bet = betSnap.data();
        if (bet.status !== 'matched') return;

        const actualValue = findPlayerStat(players, bet.player, bet.stat);

        if (actualValue === null) {
          if (!bet.postDetectedAt) {
            tx.update(betRef, { postDetectedAt: Date.now() });
            return;
          }
          didSettle = true;
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
          const loserId = creatorWins ? bet.takerId : bet.creatorId;
          const winnerStake = creatorWins ? bet.creatorStake : bet.takerStake;
          const winnerRef = doc(firestore, 'users', winnerId);
          const winnerSnap = await tx.get(winnerRef);
          if (winnerSnap.exists()) {
            tx.update(winnerRef, { coins: (winnerSnap.data().coins ?? 0) + totalPool });
          }
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

      if (didSettle && settleResult) {
        const { winnerId, loserId, profit } = settleResult;
        trackChallenge(winnerId, 'bet_won', { profit }).catch(() => {});
        trackChallenge(loserId, 'bet_lost').catch(() => {});
      }
    } catch { /* continue */ }
  }
}
