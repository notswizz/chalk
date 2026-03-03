import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Favorites',
  description: 'Your saved games — quick access to the matchups you care about.',
  openGraph: {
    title: 'Favorites | Chalk',
    description: 'Your saved games — quick access to the matchups you care about.',
  },
};

export default function FavoritesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
