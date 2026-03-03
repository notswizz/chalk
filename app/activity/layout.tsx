import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Activity',
  description: 'Your betting history — wins, losses, and everything on the board.',
  openGraph: {
    title: 'Activity | Chalk',
    description: 'Your betting history — wins, losses, and everything on the board.',
  },
};

export default function ActivityLayout({ children }: { children: React.ReactNode }) {
  return children;
}
