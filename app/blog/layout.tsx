import { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    default: 'Blog — Free NBA Streams, Player Props & Sports Betting Tips',
    template: '%s | Chalk Blog',
  },
  description: 'Guides on free NBA streaming, player prop betting strategies, and the best alternatives to StreamEast and Buffstreams. Watch live NBA games and bet on player props.',
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {children}
    </div>
  );
}
