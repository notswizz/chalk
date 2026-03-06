import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Leaderboard — Top NBA Prop Bettors & Rankings',
  description: 'See who\'s winning the most NBA player prop bets on Chalk. Rankings, win rates, and profit leaders. Compete with the best sports bettors on the free live streaming platform.',
  openGraph: {
    title: 'Leaderboard — Top NBA Prop Bettors | Chalk',
    description: 'Rankings, win rates, and profit leaders. Compete with the best on Chalk.',
  },
};

export default function LeaderboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
