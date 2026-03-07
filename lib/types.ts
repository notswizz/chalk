export interface Game {
  id: string;
  sport: Sport;
  date: string;
  state: 'pre' | 'in' | 'post';
  displayClock: string;
  period: number;
  shortDetail: string;
  homeTeam: Team;
  awayTeam: Team;
  venue: string;
  broadcast: string;
  streamCount?: number;
}

export interface Team {
  id?: string;
  abbreviation: string;
  displayName: string;
  logo: string;
  score: string;
  homeAway: 'home' | 'away';
}

export type Sport = 'nba' | 'ncaam';

export interface SportConfig {
  key: Sport;
  label: string;
  emoji: string;
  espnPath: string;
  enabled: boolean;
}

export const SPORTS: SportConfig[] = [
  { key: 'nba', label: 'NBA', emoji: '🏀', espnPath: 'basketball/nba', enabled: true },
  { key: 'ncaam', label: 'NCAA', emoji: '🏀', espnPath: 'basketball/mens-college-basketball', enabled: true },
];

export type TournamentRound =
  | 'round_of_64'
  | 'round_of_32'
  | 'sweet_16'
  | 'elite_eight'
  | 'final_four'
  | 'championship'
  | 'win_it_all';

export const ROUND_ORDER: TournamentRound[] = [
  'round_of_64',
  'round_of_32',
  'sweet_16',
  'elite_eight',
  'final_four',
  'championship',
  'win_it_all',
];

export const ROUND_LABELS: Record<TournamentRound, string> = {
  round_of_64: 'Round of 64',
  round_of_32: 'Round of 32',
  sweet_16: 'Sweet 16',
  elite_eight: 'Elite Eight',
  final_four: 'Final Four',
  championship: 'Championship',
  win_it_all: 'Win It All',
};

export interface TournamentTeam {
  id: string;
  name: string;
  abbreviation: string;
  seed: number;
  logo: string;
}

export interface TournamentProp {
  id: string;
  type: 'tournament';
  teamId: string;
  teamName: string;
  teamSeed: number;
  teamLogo: string;
  round: TournamentRound;
  direction: 'WILL' | 'WILL_NOT';
  odds: number;
  oppositeOdds: number;
  stake: number;
  takerStake: number;
  status: 'open' | 'matched' | 'won' | 'lost' | 'push' | 'cancelled';
  creatorId: string;
  creatorName: string;
  takerId?: string;
  takerName?: string;
  settledAt?: number;
  settledRound?: string;
  createdAt: number;
  matchedAt?: number;
}

export interface StreamLink {
  url: string;
  source: string;
  quality: 'HD' | 'SD' | 'unknown';
  type: 'hls' | 'iframe';
  sourceName?: string;
  id?: string;
}
