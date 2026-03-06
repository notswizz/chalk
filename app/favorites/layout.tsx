import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Favorites — Your Saved NBA Games & Teams',
  description: 'Quick access to your favorite NBA teams and matchups. Follow live games, get scores, and bet on player props for the teams you care about on Chalk.',
  openGraph: {
    title: 'Favorite Teams & Games | Chalk',
    description: 'Follow your favorite NBA teams with live scores and player prop betting on Chalk.',
  },
};

export default function FavoritesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
