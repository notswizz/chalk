import { firestore } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  getDefaultChallenges,
  getTodayEST,
  ACHIEVEMENTS,
  MILESTONES,
  UserChallenges,
} from '@/lib/challenges';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NewReward {
  id: string;
  name: string;
  reward: number;
  type: 'achievement' | 'milestone';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetDailyIfNeeded(challenges: UserChallenges, today: string): void {
  if (challenges.daily.lastReset === today) return;
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

function checkAchievements(
  challenges: UserChallenges,
  meta: Record<string, unknown> | undefined
): NewReward[] {
  const earned: NewReward[] = [];

  const checks: Record<string, () => boolean> = {
    first_blood: () => challenges.totalWins >= 1,
    cashed: () => challenges.totalWins >= 10,
    erased: () => challenges.totalLosses >= 10,
    hot_hand: () => challenges.longestWinStreak >= 3,
    on_fire: () => challenges.longestWinStreak >= 5,
    untouchable: () => challenges.longestWinStreak >= 10,
    degen: () => challenges.totalBetsPlaced >= 50,
    whale: () => challenges.maxSingleBet >= 500,
    chalk_card_creator: () => challenges.hasChalkCard === true,
    voice_of_chalk: () => challenges.hasTtsClip === true,
    all_sports: () => challenges.sportsBetOn.length >= 2,
    march_madness: () => challenges.hasTournamentProp === true,
    social_butterfly: () => challenges.totalChatMessages >= 100,
    clipmaster: () => challenges.totalClipsCreated >= 10,
    high_roller: () => challenges.totalProfit >= 1000,
    the_oracle: () => challenges.totalWins >= 50,
  };

  for (const achievement of ACHIEVEMENTS) {
    if (achievement.id === 'cinderella_caller' || achievement.id === 'bracket_buster') {
      continue;
    }
    if (challenges.achievements.includes(achievement.id)) continue;

    const checker = checks[achievement.id];
    if (checker && checker()) {
      challenges.achievements.push(achievement.id);
      challenges.totalChallengeEarnings += achievement.reward;
      earned.push({
        id: achievement.id,
        name: achievement.name,
        reward: achievement.reward,
        type: 'achievement',
      });
    }
  }

  return earned;
}

function checkMilestones(challenges: UserChallenges): NewReward[] {
  const earned: NewReward[] = [];

  for (const milestone of MILESTONES) {
    if (challenges.achievements.includes(milestone.id)) continue;

    const statValue = (challenges as unknown as Record<string, number>)[milestone.stat];
    if (typeof statValue === 'number' && statValue >= milestone.target) {
      challenges.achievements.push(milestone.id);
      challenges.totalChallengeEarnings += milestone.reward;
      earned.push({
        id: milestone.id,
        name: milestone.name,
        reward: milestone.reward,
        type: 'milestone',
      });
    }
  }

  return earned;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Server-side challenge tracker. Loads / creates the user's challenge doc,
 * increments counters, checks achievements & milestones, awards
 * challengePoints (NOT coins), and saves the doc.
 *
 * Designed to be called fire-and-forget:
 *   trackChallenge(userId, 'bet_placed', { stake, sport }).catch(() => {})
 */
export async function trackChallenge(
  userId: string,
  action: string,
  meta?: Record<string, unknown>
): Promise<{ newRewards: NewReward[] }> {
  const today = getTodayEST();
  const challengeRef = doc(firestore, 'challenges', userId);
  const snap = await getDoc(challengeRef);

  let challenges: UserChallenges;
  if (!snap.exists()) {
    challenges = getDefaultChallenges(userId);
  } else {
    challenges = snap.data() as UserChallenges;
  }

  resetDailyIfNeeded(challenges, today);

  // -------------------------------------------------------------------------
  // Increment counters based on action
  // -------------------------------------------------------------------------

  switch (action) {
    case 'bet_placed': {
      challenges.daily.betsPlaced += 1;
      challenges.totalBetsPlaced += 1;
      if (meta?.stake && typeof meta.stake === 'number') {
        if (meta.stake > challenges.maxSingleBet) {
          challenges.maxSingleBet = meta.stake;
        }
      }
      if (meta?.sport && typeof meta.sport === 'string') {
        if (!challenges.sportsBetOn.includes(meta.sport)) {
          challenges.sportsBetOn.push(meta.sport);
        }
      }
      break;
    }
    case 'bet_won': {
      challenges.totalWins += 1;
      challenges.currentWinStreak += 1;
      if (challenges.currentWinStreak > challenges.longestWinStreak) {
        challenges.longestWinStreak = challenges.currentWinStreak;
      }
      if (meta?.profit && typeof meta.profit === 'number') {
        challenges.totalProfit += meta.profit;
      }
      break;
    }
    case 'bet_lost': {
      challenges.totalLosses += 1;
      challenges.currentWinStreak = 0;
      break;
    }
    case 'chat_message': {
      challenges.daily.chatMessages += 1;
      challenges.totalChatMessages += 1;
      break;
    }
    case 'clip_created': {
      challenges.daily.clipsCreated += 1;
      challenges.totalClipsCreated += 1;
      break;
    }
    case 'card_shared': {
      challenges.daily.cardsShared += 1;
      challenges.totalCardsShared += 1;
      break;
    }
    case 'tournament_prop': {
      challenges.hasTournamentProp = true;
      break;
    }
    case 'tts_clip': {
      challenges.hasTtsClip = true;
      break;
    }
    case 'chalk_card': {
      challenges.hasChalkCard = true;
      break;
    }
    default:
      // Unknown action — silently ignore in the helper
      return { newRewards: [] };
  }

  // -------------------------------------------------------------------------
  // Check achievements & milestones
  // -------------------------------------------------------------------------

  const newRewards: NewReward[] = [
    ...checkAchievements(challenges, meta),
    ...checkMilestones(challenges),
  ];

  // -------------------------------------------------------------------------
  // Award challengePoints (NOT coins) and persist
  // -------------------------------------------------------------------------

  const totalPointsEarned = newRewards.reduce((sum, r) => sum + r.reward, 0);

  if (totalPointsEarned > 0) {
    challenges.challengePoints = (challenges.challengePoints ?? 0) + totalPointsEarned;
  }

  await setDoc(challengeRef, challenges);

  return { newRewards };
}
