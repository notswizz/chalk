import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Leaderboard',
  description: 'See who\'s on top — rankings, win rates, and profit leaders on Chalk.',
  openGraph: {
    title: 'Leaderboard | Chalk',
    description: 'See who\'s on top — rankings, win rates, and profit leaders on Chalk.',
  },
};

export default function LeaderboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
