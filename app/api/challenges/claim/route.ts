import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { firestore } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  getDefaultChallenges,
  getTodayEST,
  DAILY_CHALLENGES,
  UserChallenges,
} from '@/lib/challenges';

// Map challenge IDs to the daily counter they require
const CHALLENGE_COUNTER_MAP: Record<string, keyof UserChallenges['daily'] | 'loggedIn'> = {
  first_chalk: 'betsPlaced',
  double_down: 'betsPlaced',
  board_regular: 'betsPlaced',
  chalk_talk: 'chatMessages',
  clip_artist: 'clipsCreated',
  share_board: 'cardsShared',
  daily_login: 'loggedIn',
};

export async function POST(req: Request) {
  try {
    const userId = await verifyAuth(req);
    const body = await req.json();
    const { challengeId } = body as { challengeId: string };

    if (!challengeId) {
      return NextResponse.json({ error: 'Missing challengeId' }, { status: 400 });
    }

    // Verify challenge exists
    const challenge = DAILY_CHALLENGES.find((c) => c.id === challengeId);
    if (!challenge) {
      return NextResponse.json({ error: 'Invalid challengeId' }, { status: 400 });
    }

    const today = getTodayEST();
    const challengeRef = doc(firestore, 'challenges', userId);
    const snap = await getDoc(challengeRef);

    let challenges: UserChallenges;
    if (!snap.exists()) {
      challenges = getDefaultChallenges(userId);
    } else {
      challenges = snap.data() as UserChallenges;
    }

    // Reset daily if needed
    if (challenges.daily.lastReset !== today) {
      challenges.daily = {
        lastReset: today,
        betsPlaced: 0,
        chatMessages: 0,
        clipsCreated: 0,
        cardsShared: 0,
        loggedIn: false,
        claimed: [],
      };
    }

    // Verify not already claimed
    if (challenges.daily.claimed.includes(challengeId)) {
      return NextResponse.json({ error: 'Challenge already claimed' }, { status: 400 });
    }

    // Verify requirement is met
    const counterKey = CHALLENGE_COUNTER_MAP[challengeId];
    if (!counterKey) {
      return NextResponse.json({ error: 'Unknown challenge mapping' }, { status: 400 });
    }

    if (counterKey === 'loggedIn') {
      if (!challenges.daily.loggedIn) {
        return NextResponse.json(
          { error: 'Requirement not met: must be logged in' },
          { status: 400 }
        );
      }
    } else {
      const currentValue = challenges.daily[counterKey];
      if (typeof currentValue === 'number' && currentValue < challenge.requirement) {
        return NextResponse.json(
          { error: `Requirement not met: need ${challenge.requirement}, have ${currentValue}` },
          { status: 400 }
        );
      }
    }

    // Mark as claimed — reward goes to points, not coins
    challenges.daily.claimed.push(challengeId);
    challenges.totalChallengeEarnings += challenge.reward;
    challenges.challengePoints = (challenges.challengePoints ?? 0) + challenge.reward;

    await setDoc(challengeRef, challenges);

    return NextResponse.json({ success: true, reward: challenge.reward, newRewards: [] });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to claim challenge';
    const status =
      message.includes('Unauthorized') || message.includes('token') ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
