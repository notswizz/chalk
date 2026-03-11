// Challenge system data model and definitions

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DailyChallenge {
  id: string;
  name: string;
  description: string;
  reward: number;
  requirement: number;
  type: 'daily';
}

export interface StreakReward {
  days: number;
  reward: number;
  label: string;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  reward: number;
  check: string; // function name used to evaluate
}

export interface Milestone {
  id: string;
  name: string;
  description: string;
  reward: number;
  stat: string;
  target: number;
}

export interface UserChallenges {
  odId: string; // typo from spec but keep it
  daily: {
    lastReset: string; // YYYY-MM-DD in EST
    betsPlaced: number;
    chatMessages: number;
    clipsCreated: number;
    cardsShared: number;
    loggedIn: boolean;
    claimed: string[];
  };
  loginStreak: number;
  lastLoginDate: string;
  longestStreak: number;
  achievements: string[];
  featuredBadge?: string;
  totalBetsPlaced: number;
  totalWins: number;
  totalLosses: number;
  currentWinStreak: number;
  longestWinStreak: number;
  totalProfit: number;
  maxSingleBet: number;
  totalChatMessages: number;
  totalClipsCreated: number;
  totalCardsShared: number;
  totalChallengeEarnings: number; // legacy — use challengePoints
  challengePoints: number;
  sportsBetOn: string[]; // ['nba', 'ncaam']
  hasTournamentProp: boolean;
  hasChalkCard: boolean;
  hasTtsClip: boolean;
}

// ---------------------------------------------------------------------------
// Daily Challenges
// ---------------------------------------------------------------------------

export const DAILY_CHALLENGES: DailyChallenge[] = [
  {
    id: 'daily_login',
    name: 'Daily Login',
    description: 'Log in to ChalkBoard',
    reward: 3,
    requirement: 1,
    type: 'daily',
  },
  {
    id: 'first_chalk',
    name: 'First Chalk',
    description: 'Place your first bet of the day',
    reward: 5,
    requirement: 1,
    type: 'daily',
  },
  {
    id: 'double_down',
    name: 'Double Down',
    description: 'Place 2 bets today',
    reward: 10,
    requirement: 2,
    type: 'daily',
  },
  {
    id: 'board_regular',
    name: 'Board Regular',
    description: 'Place 3 bets today',
    reward: 15,
    requirement: 3,
    type: 'daily',
  },
  {
    id: 'chalk_talk',
    name: 'Chalk Talk',
    description: 'Send 5 chat messages today',
    reward: 5,
    requirement: 5,
    type: 'daily',
  },
  {
    id: 'clip_artist',
    name: 'Clip Artist',
    description: 'Create a clip today',
    reward: 10,
    requirement: 1,
    type: 'daily',
  },
  {
    id: 'share_board',
    name: 'Share Board',
    description: 'Share a chalk card today',
    reward: 10,
    requirement: 1,
    type: 'daily',
  },
];

// ---------------------------------------------------------------------------
// Streak Rewards
// ---------------------------------------------------------------------------

export const STREAK_REWARDS: StreakReward[] = [
  { days: 3, reward: 25, label: '3-Day Streak' },
  { days: 7, reward: 75, label: '7-Day Streak' },
  { days: 14, reward: 200, label: '14-Day Streak' },
  { days: 30, reward: 500, label: '30-Day Streak' },
];

// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_blood',
    name: 'First Blood',
    description: 'Win your first bet',
    reward: 25,
    check: 'checkFirstBlood',
  },
  {
    id: 'cashed',
    name: 'Cashed',
    description: 'Win 10 bets',
    reward: 50,
    check: 'checkCashed',
  },
  {
    id: 'erased',
    name: 'Erased',
    description: 'Lose 10 bets',
    reward: 25,
    check: 'checkErased',
  },
  {
    id: 'hot_hand',
    name: 'Hot Hand',
    description: 'Win 3 bets in a row',
    reward: 50,
    check: 'checkHotHand',
  },
  {
    id: 'on_fire',
    name: 'On Fire',
    description: 'Win 5 bets in a row',
    reward: 100,
    check: 'checkOnFire',
  },
  {
    id: 'untouchable',
    name: 'Untouchable',
    description: 'Win 10 bets in a row',
    reward: 250,
    check: 'checkUntouchable',
  },
  {
    id: 'degen',
    name: 'Degen',
    description: 'Place 50 bets',
    reward: 100,
    check: 'checkDegen',
  },
  {
    id: 'whale',
    name: 'Whale',
    description: 'Place a single bet of 500 coins or more',
    reward: 100,
    check: 'checkWhale',
  },
  {
    id: 'chalk_card_creator',
    name: 'Chalk Card Creator',
    description: 'Create your first chalk card',
    reward: 25,
    check: 'checkChalkCardCreator',
  },
  {
    id: 'voice_of_chalk',
    name: 'Voice of Chalk',
    description: 'Create a TTS clip',
    reward: 25,
    check: 'checkVoiceOfChalk',
  },
  {
    id: 'all_sports',
    name: 'All Sports',
    description: 'Place bets on at least 2 different sports',
    reward: 50,
    check: 'checkAllSports',
  },
  {
    id: 'march_madness',
    name: 'March Madness',
    description: 'Place a bet during March Madness',
    reward: 50,
    check: 'checkMarchMadness',
  },
  {
    id: 'cinderella_caller',
    name: 'Cinderella Caller',
    description: 'Win a tournament underdog bet',
    reward: 100,
    check: 'checkCinderellaCaller',
  },
  {
    id: 'bracket_buster',
    name: 'Bracket Buster',
    description: 'Place a tournament prop bet',
    reward: 50,
    check: 'checkBracketBuster',
  },
  {
    id: 'social_butterfly',
    name: 'Social Butterfly',
    description: 'Send 100 chat messages',
    reward: 50,
    check: 'checkSocialButterfly',
  },
  {
    id: 'clipmaster',
    name: 'Clipmaster',
    description: 'Create 10 clips',
    reward: 100,
    check: 'checkClipmaster',
  },
  {
    id: 'high_roller',
    name: 'High Roller',
    description: 'Earn 1,000 coins in profit',
    reward: 200,
    check: 'checkHighRoller',
  },
  {
    id: 'the_oracle',
    name: 'The Oracle',
    description: 'Win 50 bets',
    reward: 500,
    check: 'checkTheOracle',
  },
];

// ---------------------------------------------------------------------------
// Milestones
// ---------------------------------------------------------------------------

export const MILESTONES: Milestone[] = [
  {
    id: 'bets_10',
    name: '10 Bets Placed',
    description: 'Place 10 bets',
    reward: 25,
    stat: 'totalBetsPlaced',
    target: 10,
  },
  {
    id: 'bets_50',
    name: '50 Bets Placed',
    description: 'Place 50 bets',
    reward: 75,
    stat: 'totalBetsPlaced',
    target: 50,
  },
  {
    id: 'bets_100',
    name: '100 Bets Placed',
    description: 'Place 100 bets',
    reward: 200,
    stat: 'totalBetsPlaced',
    target: 100,
  },
  {
    id: 'wins_10',
    name: '10 Wins',
    description: 'Win 10 bets',
    reward: 50,
    stat: 'totalWins',
    target: 10,
  },
  {
    id: 'wins_50',
    name: '50 Wins',
    description: 'Win 50 bets',
    reward: 200,
    stat: 'totalWins',
    target: 50,
  },
  {
    id: 'profit_1000',
    name: '1K Profit',
    description: 'Earn 1,000 coins in profit',
    reward: 100,
    stat: 'totalProfit',
    target: 1000,
  },
  {
    id: 'profit_10000',
    name: '10K Profit',
    description: 'Earn 10,000 coins in profit',
    reward: 500,
    stat: 'totalProfit',
    target: 10000,
  },
];

// ---------------------------------------------------------------------------
// Utility Functions
// ---------------------------------------------------------------------------

/**
 * Returns today's date as YYYY-MM-DD in US Eastern time.
 */
export function getTodayEST(): string {
  const now = new Date();
  const est = new Date(
    now.toLocaleString('en-US', { timeZone: 'America/New_York' })
  );
  const year = est.getFullYear();
  const month = String(est.getMonth() + 1).padStart(2, '0');
  const day = String(est.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns the time remaining until the next midnight EST reset.
 */
export function getResetCountdown(): { hours: number; minutes: number } {
  const now = new Date();
  const estNow = new Date(
    now.toLocaleString('en-US', { timeZone: 'America/New_York' })
  );
  const midnightEST = new Date(estNow);
  midnightEST.setDate(midnightEST.getDate() + 1);
  midnightEST.setHours(0, 0, 0, 0);

  const diffMs = midnightEST.getTime() - estNow.getTime();
  const totalMinutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return { hours, minutes };
}

/**
 * Returns a UserChallenges object initialised with sensible defaults.
 */
export function getDefaultChallenges(userId: string): UserChallenges {
  return {
    odId: userId,
    daily: {
      lastReset: getTodayEST(),
      betsPlaced: 0,
      chatMessages: 0,
      clipsCreated: 0,
      cardsShared: 0,
      loggedIn: false,
      claimed: [],
    },
    loginStreak: 0,
    lastLoginDate: '',
    longestStreak: 0,
    achievements: [],
    featuredBadge: '',
    totalBetsPlaced: 0,
    totalWins: 0,
    totalLosses: 0,
    currentWinStreak: 0,
    longestWinStreak: 0,
    totalProfit: 0,
    maxSingleBet: 0,
    totalChatMessages: 0,
    totalClipsCreated: 0,
    totalCardsShared: 0,
    totalChallengeEarnings: 0,
    challengePoints: 0,
    sportsBetOn: [],
    hasTournamentProp: false,
    hasChalkCard: false,
    hasTtsClip: false,
  };
}
