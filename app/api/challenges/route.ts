import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { firestore } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  getDefaultChallenges,
  getTodayEST,
  STREAK_REWARDS,
  UserChallenges,
} from '@/lib/challenges';

function getYesterdayEST(): string {
  const now = new Date();
  const est = new Date(
    now.toLocaleString('en-US', { timeZone: 'America/New_York' })
  );
  est.setDate(est.getDate() - 1);
  const year = est.getFullYear();
  const month = String(est.getMonth() + 1).padStart(2, '0');
  const day = String(est.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function resetDailyIfNeeded(challenges: UserChallenges, today: string): boolean {
  if (challenges.daily.lastReset === today) return false;
  challenges.daily = {
    lastReset: today,
    betsPlaced: 0,
    chatMessages: 0,
    clipsCreated: 0,
    cardsShared: 0,
    loggedIn: false,
    claimed: [],
  };
  return true;
}

export async function GET(req: Request) {
  try {
    const userId = await verifyAuth(req);
    const today = getTodayEST();
    const yesterday = getYesterdayEST();

    const challengeRef = doc(firestore, 'challenges', userId);
    const snap = await getDoc(challengeRef);

    let challenges: UserChallenges;
    let isNew = false;

    if (!snap.exists()) {
      challenges = getDefaultChallenges(userId);
      isNew = true;
    } else {
      challenges = snap.data() as UserChallenges;
    }

    // Reset daily if needed
    resetDailyIfNeeded(challenges, today);

    // Handle daily login
    const newRewards: { id: string; label: string; reward: number; type: string }[] = [];

    if (!challenges.daily.loggedIn) {
      challenges.daily.loggedIn = true;

      if (challenges.lastLoginDate === yesterday) {
        challenges.loginStreak += 1;
      } else if (challenges.lastLoginDate !== today) {
        challenges.loginStreak = 1;
      }

      challenges.lastLoginDate = today;
      if (challenges.loginStreak > challenges.longestStreak) {
        challenges.longestStreak = challenges.loginStreak;
      }

      // Check for streak rewards
      for (const sr of STREAK_REWARDS) {
        const rewardId = `streak_${sr.days}`;
        if (
          challenges.loginStreak >= sr.days &&
          !challenges.achievements.includes(rewardId)
        ) {
          challenges.achievements.push(rewardId);
          challenges.totalChallengeEarnings += sr.reward;
          challenges.challengePoints = (challenges.challengePoints ?? 0) + sr.reward;
          newRewards.push({
            id: rewardId,
            label: sr.label,
            reward: sr.reward,
            type: 'streak',
          });
        }
      }
    }

    // Save challenge doc
    await setDoc(challengeRef, challenges);

    return NextResponse.json({ challenges, newRewards });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to fetch challenges';
    const status =
      message.includes('Unauthorized') || message.includes('token') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
