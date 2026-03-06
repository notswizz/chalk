import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'The Board — Live NBA Player Props & Bets',
  description: 'Browse and bet on live NBA player props — points, rebounds, assists, 3-pointers. Take the other side or draw up your own. Free player prop betting alternative to StreamEast and Buffstreams.',
  openGraph: {
    title: 'The Board — Live NBA Player Props | Chalk',
    description: 'Browse and bet on live NBA player props. Free sports betting with real-time scores.',
  },
};

export default function BetsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
