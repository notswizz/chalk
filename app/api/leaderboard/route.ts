import { NextResponse } from 'next/server';
import { firestore } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

interface UserStats {
  userId: string;
  displayName: string;
  avatarUrl: string;
  wins: number;
  losses: number;
  pushes: number;
  winRate: number;
  totalProfit: number;
  percentGain: number;
  volume: number;
  betsCount: number;
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

    // Build stats map
    const statsMap = new Map<string, {
      wins: number;
      losses: number;
      pushes: number;
      totalProfit: number;
      volume: number;
      betsCount: number;
    }>();

    const getOrCreate = (userId: string) => {
      if (!statsMap.has(userId)) {
        statsMap.set(userId, { wins: 0, losses: 0, pushes: 0, totalProfit: 0, volume: 0, betsCount: 0 });
      }
      return statsMap.get(userId)!;
    };

    for (const doc of betsSnap.docs) {
      const bet = doc.data();
      const { creatorId, takerId, creatorStake, takerStake, result } = bet;
      if (!creatorId || !takerId || !result) continue;

      const pool = creatorStake + takerStake;
      const creatorStats = getOrCreate(creatorId);
      const takerStats = getOrCreate(takerId);

      // Creator side
      creatorStats.volume += creatorStake;
      creatorStats.betsCount += 1;

      // Taker side
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
        // push
        creatorStats.pushes += 1;
        takerStats.pushes += 1;
      }
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

    // Build final array
    const leaderboard: UserStats[] = [];
    for (const [userId, stats] of statsMap) {
      const user = usersMap.get(userId);
      const totalDecided = stats.wins + stats.losses;
      leaderboard.push({
        userId,
        displayName: user?.displayName || 'Anonymous',
        avatarUrl: user?.avatarUrl || '',
        wins: stats.wins,
        losses: stats.losses,
        pushes: stats.pushes,
        winRate: totalDecided > 0 ? Math.round((stats.wins / totalDecided) * 1000) / 10 : 0,
        totalProfit: Math.round(stats.totalProfit * 100) / 100,
        percentGain: stats.volume > 0 ? Math.round((stats.totalProfit / stats.volume) * 1000) / 10 : 0,
        volume: Math.round(stats.volume * 100) / 100,
        betsCount: stats.betsCount,
      });
    }

    // Default sort: by total profit descending
    leaderboard.sort((a, b) => b.totalProfit - a.totalProfit);

    // Cache result
    cachedResult = { data: leaderboard, timestamp: Date.now() };

    return NextResponse.json({ leaderboard });
  } catch (e: unknown) {
    console.error('Leaderboard error:', e);
    return NextResponse.json({ error: 'Failed to load leaderboard' }, { status: 500 });
  }
}
