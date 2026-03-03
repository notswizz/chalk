import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'The Board',
  description: 'Browse open props, live bets, and score checks. Take the other side or draw up your own.',
  openGraph: {
    title: 'The Board | Chalk',
    description: 'Browse open props, live bets, and score checks.',
  },
};

export default function BetsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
