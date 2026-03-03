import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Clips',
  description: 'Watch and share game highlights clipped live from Chalk streams.',
  openGraph: {
    title: 'Clips | Chalk',
    description: 'Watch and share game highlights clipped live from Chalk streams.',
  },
};

export default function ClipsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
