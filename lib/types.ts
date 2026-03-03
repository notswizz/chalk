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
  abbreviation: string;
  displayName: string;
  logo: string;
  score: string;
  homeAway: 'home' | 'away';
}

export type Sport = 'nba';

export const SPORTS: { key: Sport; label: string; emoji: string }[] = [
  { key: 'nba', label: 'NBA', emoji: '🏀' },
];

export interface StreamLink {
  url: string;
  source: string;
  quality: 'HD' | 'SD' | 'unknown';
  type: 'hls' | 'iframe';
  sourceName?: string;
  id?: string;
}
