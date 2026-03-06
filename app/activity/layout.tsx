import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Activity — Your Player Prop Betting History',
  description: 'Track your NBA player prop bets — wins, losses, pushes, and profit. Full betting history with real-time results from live games on Chalk.',
  openGraph: {
    title: 'Betting Activity & History | Chalk',
    description: 'Track your NBA player prop bets — wins, losses, and profit on Chalk.',
  },
};

export default function ActivityLayout({ children }: { children: React.ReactNode }) {
  return children;
}
