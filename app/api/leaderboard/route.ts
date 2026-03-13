import { NextResponse } from 'next/server';
import { firestore } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

interface UserStats {
  userId: string;
  displayName: string;
  avatarUrl: string;
  challengePoints: number;
  wins: number;
  losses: number;
  pushes: number;
  winRate: number;
  totalProfit: number;
  percentGain: number;
  volume: number;
  betsCount: number;
  openBets: number;
  liveBets: number;
  pendingChalk: number;
}

// In-memory cache
let cachedResult: { data: UserStats[]; timestamp: number } | null = null;
const CACHE_TTL = 60_000; // 60 seconds

export async function GET() {
  try {
    // Return cached result if fresh
    if (cachedResult && Date.now() - cachedResult.timestamp < CACHE_TTL) {
      return NextResponse.json({ leaderboard: cachedResult.data });
    }

    // Query all settled bets
    const betsSnap = await getDocs(
      query(collection(firestore, 'bets'), where('status', '==', 'settled'))
    );

    // Query open bets
    const openSnap = await getDocs(
      query(collection(firestore, 'bets'), where('status', '==', 'open'))
    );

    // Query matched (live) bets
    const matchedSnap = await getDocs(
      query(collection(firestore, 'bets'), where('status', '==', 'matched'))
    );

    // Build stats map
    const statsMap = new Map<string, {
      wins: number;
      losses: number;
      pushes: number;
      totalProfit: number;
      volume: number;
      betsCount: number;
      openBets: number;
      liveBets: number;
      pendingChalk: number;
    }>();

    const getOrCreate = (userId: string) => {
      if (!statsMap.has(userId)) {
        statsMap.set(userId, {
          wins: 0, losses: 0, pushes: 0, totalProfit: 0, volume: 0, betsCount: 0,
          openBets: 0, liveBets: 0, pendingChalk: 0,
        });
      }
      return statsMap.get(userId)!;
    };

    // Process settled bets
    for (const doc of betsSnap.docs) {
      const bet = doc.data();
      const { creatorId, takerId, creatorStake, takerStake, result } = bet;
      if (!creatorId || !takerId || !result) continue;

      const pool = creatorStake + takerStake;
      const creatorStats = getOrCreate(creatorId);
      const takerStats = getOrCreate(takerId);

      creatorStats.volume += creatorStake;
      creatorStats.betsCount += 1;
      takerStats.volume += takerStake;
      takerStats.betsCount += 1;

      if (result === 'creator_wins') {
        creatorStats.wins += 1;
        creatorStats.totalProfit += pool - creatorStake;
        takerStats.losses += 1;
        takerStats.totalProfit -= takerStake;
      } else if (result === 'taker_wins') {
        takerStats.wins += 1;
        takerStats.totalProfit += pool - takerStake;
        creatorStats.losses += 1;
        creatorStats.totalProfit -= creatorStake;
      } else {
        creatorStats.pushes += 1;
        takerStats.pushes += 1;
      }
    }

    // Process open bets (only creator has stake locked)
    for (const doc of openSnap.docs) {
      const bet = doc.data();
      const { creatorId, creatorStake } = bet;
      if (!creatorId) continue;

      const stats = getOrCreate(creatorId);
      stats.openBets += 1;
      stats.pendingChalk += creatorStake || 0;
    }

    // Process matched (live) bets (both sides have stake locked)
    for (const doc of matchedSnap.docs) {
      const bet = doc.data();
      const { creatorId, takerId, creatorStake, takerStake } = bet;
      if (!creatorId || !takerId) continue;

      const creatorStats = getOrCreate(creatorId);
      const takerStats = getOrCreate(takerId);

      creatorStats.liveBets += 1;
      creatorStats.pendingChalk += creatorStake || 0;

      takerStats.liveBets += 1;
      takerStats.pendingChalk += takerStake || 0;
    }

    // Query all users for display names and avatars
    const usersSnap = await getDocs(collection(firestore, 'users'));
    const usersMap = new Map<string, { displayName: string; avatarUrl: string }>();
    for (const doc of usersSnap.docs) {
      const data = doc.data();
      usersMap.set(doc.id, {
        displayName: data.displayName || 'Anonymous',
        avatarUrl: data.avatarUrl || '',
      });
    }

    // Query challenges collection for points
    const challengesSnap = await getDocs(collection(firestore, 'challenges'));
    const challengePointsMap = new Map<string, number>();
    for (const doc of challengesSnap.docs) {
      const data = doc.data();
      challengePointsMap.set(doc.id, data.challengePoints ?? 0);
    }

    // Build final array
    const leaderboard: UserStats[] = [];
    for (const [userId, stats] of statsMap) {
      const user = usersMap.get(userId);
      const totalDecided = stats.wins + stats.losses;
      leaderboard.push({
        userId,
        displayName: user?.displayName || 'Anonymous',
        avatarUrl: user?.avatarUrl || '',
        challengePoints: challengePointsMap.get(userId) ?? 0,
        wins: stats.wins,
        losses: stats.losses,
        pushes: stats.pushes,
        winRate: totalDecided > 0 ? Math.round((stats.wins / totalDecided) * 1000) / 10 : 0,
        totalProfit: Math.round(stats.totalProfit * 100) / 100,
        percentGain: stats.volume > 0 ? Math.round((stats.totalProfit / stats.volume) * 1000) / 10 : 0,
        volume: Math.round(stats.volume * 100) / 100,
        betsCount: stats.betsCount,
        openBets: stats.openBets,
        liveBets: stats.liveBets,
        pendingChalk: Math.round(stats.pendingChalk * 100) / 100,
      });
    }

    // Filter out ChalkBot / anonymous entries
    const filtered = leaderboard.filter((e) => e.userId !== 'system:chalk-props' && e.displayName !== 'Anonymous');

    // Default sort: by total profit descending
    filtered.sort((a, b) => b.totalProfit - a.totalProfit);

    // Cache result
    cachedResult = { data: filtered, timestamp: Date.now() };

    return NextResponse.json({ leaderboard: filtered });
  } catch (e: unknown) {
    console.error('Leaderboard error:', e);
    return NextResponse.json({ error: 'Failed to load leaderboard' }, { status: 500 });
  }
}
