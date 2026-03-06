import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Clips — NBA Highlights & Live Game Clips',
  description: 'Watch and share NBA highlights clipped live from Chalk streams. Free NBA game clips, buzzer beaters, dunks, and clutch plays. Better highlights than StreamEast or Buffstreams.',
  openGraph: {
    title: 'NBA Highlights & Live Game Clips | Chalk',
    description: 'Watch and share NBA highlights clipped live from Chalk streams. Free NBA clips and buzzer beaters.',
  },
};

export default function ClipsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
