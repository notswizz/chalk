import { NextResponse } from 'next/server';
import { firestore } from '@/lib/firebase';
import { getPrivyUserEmail } from '@/lib/auth';
import { collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';

const CHALKBOT_ID = 'system:chalk-props';

// Cache for 30 seconds
let cachedResult: { data: unknown; timestamp: number } | null = null;
const CACHE_TTL = 30_000;

export async function GET(req: Request) {
  try {
    // Simple admin auth via query param (replace with proper auth later)
    const { searchParams } = new URL(req.url);
    const key = searchParams.get('key');
    if (key !== process.env.ADMIN_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const shouldBackfill = searchParams.get('backfill') === '1';
    if (!shouldBackfill && cachedResult && Date.now() - cachedResult.timestamp < CACHE_TTL) {
      return NextResponse.json(cachedResult.data);
    }

    // Fetch all collections in parallel
    const [usersSnap, settledSnap, openSnap, matchedSnap, cancelledSnap, transactionsSnap] =
      await Promise.all([
        getDocs(collection(firestore, 'users')),
        getDocs(query(collection(firestore, 'bets'), where('status', '==', 'settled'))),
        getDocs(query(collection(firestore, 'bets'), where('status', '==', 'open'))),
        getDocs(query(collection(firestore, 'bets'), where('status', '==', 'matched'))),
        getDocs(query(collection(firestore, 'bets'), where('status', '==', 'cancelled'))),
        getDocs(collection(firestore, 'transactions')),
      ]);

    // ── Users ──
    let totalUsers = 0;
    let totalCoinsInCirculation = 0;
    let totalReferrals = 0;
    const usersList: { id: string; name: string; email: string; coins: number; walletAddress: string; createdAt: number }[] = [];

    for (const doc of usersSnap.docs) {
      const d = doc.data();
      totalUsers++;
      totalCoinsInCirculation += d.coins ?? 0;
      totalReferrals += d.referralCount ?? 0;
      usersList.push({
        id: doc.id,
        name: d.displayName || 'Anonymous',
        email: d.email || '',
        coins: d.coins ?? 0,
        walletAddress: d.walletAddress || '',
        createdAt: d.createdAt ?? 0,
      });
    }

    // ── Backfill emails from Privy if requested ──
    if (shouldBackfill) {
      const noEmail = usersList.filter((u) => !u.email);
      await Promise.all(
        noEmail.map(async (u) => {
          const email = await getPrivyUserEmail(u.id);
          if (email) {
            u.email = email;
            await updateDoc(doc(firestore, 'users', u.id), { email });
          }
        })
      );
    }

    // ── ChalkBot Stats ──
    let chalkbotWins = 0;
    let chalkbotLosses = 0;
    let chalkbotPushes = 0;
    let chalkbotTokensEmitted = 0; // tokens paid out to users who beat chalkbot
    let chalkbotTokensGained = 0;  // tokens absorbed when users lose to chalkbot
    let chalkbotBetsCreated = 0;

    // ── Overall Bet Stats ──
    let totalSettled = settledSnap.size;
    let totalOpen = openSnap.size;
    let totalMatched = matchedSnap.size;
    let totalCancelled = cancelledSnap.size;
    let totalVolume = 0;
    let totalCreatorWins = 0;
    let totalTakerWins = 0;
    let totalPushes = 0;

    // Volume by sport
    const volumeBySport: Record<string, number> = {};
    // Volume by day (last 30 days)
    const volumeByDay: Record<string, number> = {};
    const betsByDay: Record<string, number> = {};
    // Top players by profit
    const playerProfits: Record<string, { name: string; profit: number; wins: number; losses: number; volume: number }> = {};

    const getOrCreatePlayer = (id: string, name: string) => {
      if (!playerProfits[id]) {
        playerProfits[id] = { name, profit: 0, wins: 0, losses: 0, volume: 0 };
      }
      return playerProfits[id];
    };

    // Process settled bets
    for (const betDoc of settledSnap.docs) {
      const bet = betDoc.data();
      const pool = (bet.creatorStake ?? 0) + (bet.takerStake ?? 0);
      totalVolume += pool;

      // Sport breakdown
      const sport = bet.sport || 'unknown';
      volumeBySport[sport] = (volumeBySport[sport] || 0) + pool;

      // Day breakdown
      if (bet.settledAt) {
        const day = new Date(bet.settledAt).toISOString().slice(0, 10);
        volumeByDay[day] = (volumeByDay[day] || 0) + pool;
        betsByDay[day] = (betsByDay[day] || 0) + 1;
      }

      // Result tracking
      if (bet.result === 'creator_wins') totalCreatorWins++;
      else if (bet.result === 'taker_wins') totalTakerWins++;
      else totalPushes++;

      // ChalkBot tracking
      const isChalkbotCreator = bet.creatorId === CHALKBOT_ID;
      const isChalkbotTaker = bet.takerId === CHALKBOT_ID;

      if (isChalkbotCreator) {
        chalkbotBetsCreated++;
        if (bet.result === 'creator_wins') {
          chalkbotWins++;
          chalkbotTokensGained += bet.takerStake ?? 0;
        } else if (bet.result === 'taker_wins') {
          chalkbotLosses++;
          chalkbotTokensEmitted += pool; // user gets full pool
        } else {
          chalkbotPushes++;
        }
      } else if (isChalkbotTaker) {
        if (bet.result === 'taker_wins') {
          chalkbotWins++;
          chalkbotTokensGained += bet.creatorStake ?? 0;
        } else if (bet.result === 'creator_wins') {
          chalkbotLosses++;
          chalkbotTokensEmitted += pool;
        } else {
          chalkbotPushes++;
        }
      }

      // Player profit tracking (skip chalkbot)
      if (bet.creatorId && bet.creatorId !== CHALKBOT_ID && bet.result) {
        const p = getOrCreatePlayer(bet.creatorId, bet.creatorName || 'Anonymous');
        p.volume += bet.creatorStake ?? 0;
        if (bet.result === 'creator_wins') {
          p.wins++;
          p.profit += (bet.takerStake ?? 0);
        } else if (bet.result === 'taker_wins') {
          p.losses++;
          p.profit -= (bet.creatorStake ?? 0);
        }
      }
      if (bet.takerId && bet.takerId !== CHALKBOT_ID && bet.result) {
        const p = getOrCreatePlayer(bet.takerId, bet.takerName || 'Anonymous');
        p.volume += bet.takerStake ?? 0;
        if (bet.result === 'taker_wins') {
          p.wins++;
          p.profit += (bet.creatorStake ?? 0);
        } else if (bet.result === 'creator_wins') {
          p.losses++;
          p.profit -= (bet.takerStake ?? 0);
        }
      }
    }

    // Add open/matched volume
    let openVolume = 0;
    let matchedVolume = 0;

    for (const betDoc of openSnap.docs) {
      const bet = betDoc.data();
      openVolume += bet.creatorStake ?? 0;
      if (bet.creatorId === CHALKBOT_ID) chalkbotBetsCreated++;

      if (bet.createdAt) {
        const day = new Date(bet.createdAt).toISOString().slice(0, 10);
        betsByDay[day] = (betsByDay[day] || 0) + 1;
      }
    }

    for (const betDoc of matchedSnap.docs) {
      const bet = betDoc.data();
      matchedVolume += (bet.creatorStake ?? 0) + (bet.takerStake ?? 0);

      if (bet.createdAt) {
        const day = new Date(bet.createdAt).toISOString().slice(0, 10);
        betsByDay[day] = (betsByDay[day] || 0) + 1;
      }
    }

    // ── Transactions (deposits/withdrawals) ──
    let totalDeposits = 0;
    let totalDepositAmount = 0;
    let totalWithdrawals = 0;
    let totalWithdrawalAmount = 0;
    let pendingWithdrawals = 0;
    let failedWithdrawals = 0;

    for (const txDoc of transactionsSnap.docs) {
      const tx = txDoc.data();
      if (tx.type === 'deposit' && tx.status === 'confirmed') {
        totalDeposits++;
        totalDepositAmount += tx.amount ?? 0;
      } else if (tx.type === 'withdrawal') {
        if (tx.status === 'confirmed') {
          totalWithdrawals++;
          totalWithdrawalAmount += tx.amount ?? 0;
        } else if (tx.status === 'pending') {
          pendingWithdrawals++;
        } else if (tx.status === 'failed') {
          failedWithdrawals++;
        }
      }
    }

    // Sort volume by day (last 30)
    const sortedDays = Object.entries(volumeByDay)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 30);

    const sortedBetDays = Object.entries(betsByDay)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 30);

    // Top 10 players by profit
    const topPlayers = Object.entries(playerProfits)
      .map(([id, p]) => ({ id, ...p }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 10);

    // Bottom 10 (biggest losers)
    const bottomPlayers = Object.entries(playerProfits)
      .map(([id, p]) => ({ id, ...p }))
      .sort((a, b) => a.profit - b.profit)
      .slice(0, 10);

    // Top holders
    const topHolders = usersList
      .sort((a, b) => b.coins - a.coins)
      .slice(0, 15)
      .map((u) => ({ name: u.name, coins: u.coins }));

    // All users sorted by most recent
    const allUsers = [...usersList]
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((u) => ({ id: u.id, name: u.name, email: u.email, coins: u.coins, createdAt: u.createdAt }));

    const data = {
      overview: {
        totalUsers,
        totalCoinsInCirculation: Math.round(totalCoinsInCirculation),
        totalReferrals,
        totalBets: totalSettled + totalOpen + totalMatched + totalCancelled,
        totalSettled,
        totalOpen,
        totalMatched,
        totalCancelled,
        totalVolume: Math.round(totalVolume),
        openVolume: Math.round(openVolume),
        matchedVolume: Math.round(matchedVolume),
        totalCreatorWins,
        totalTakerWins,
        totalPushes,
      },
      chalkbot: {
        totalBetsCreated: chalkbotBetsCreated,
        wins: chalkbotWins,
        losses: chalkbotLosses,
        pushes: chalkbotPushes,
        winRate: chalkbotWins + chalkbotLosses > 0
          ? Math.round((chalkbotWins / (chalkbotWins + chalkbotLosses)) * 1000) / 10
          : 0,
        tokensEmitted: Math.round(chalkbotTokensEmitted),
        tokensGained: Math.round(chalkbotTokensGained),
        netTokens: Math.round(chalkbotTokensGained - chalkbotTokensEmitted),
      },
      transactions: {
        totalDeposits,
        totalDepositAmount: Math.round(totalDepositAmount),
        totalWithdrawals,
        totalWithdrawalAmount: Math.round(totalWithdrawalAmount),
        pendingWithdrawals,
        failedWithdrawals,
        netFlow: Math.round(totalDepositAmount - totalWithdrawalAmount),
      },
      volumeBySport,
      volumeByDay: sortedDays,
      betsByDay: sortedBetDays,
      topPlayers,
      bottomPlayers,
      topHolders,
      users: allUsers,
    };

    cachedResult = { data, timestamp: Date.now() };
    return NextResponse.json(data);
  } catch (e: unknown) {
    console.error('Admin stats error:', e);
    return NextResponse.json({ error: 'Failed to load stats' }, { status: 500 });
  }
}
