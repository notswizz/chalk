import { Metadata } from 'next';
import { fetchGameById } from '@/lib/espn';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;

  try {
    const game = await fetchGameById(id);
    if (game) {
      const title = `${game.awayTeam.displayName} vs ${game.homeTeam.displayName}`;
      const description = `Watch ${title} live and bet on player props with CHALK.`;
      return {
        title,
        description,
        openGraph: {
          title: `${title} | Chalk`,
          description,
          images: game.homeTeam.logo ? [{ url: game.homeTeam.logo, width: 128, height: 128 }] : [],
        },
        twitter: {
          card: 'summary',
          title: `${title} | Chalk`,
          description,
        },
      };
    }
  } catch {
    // fall through
  }

  return { title: 'Game | Chalk' };
}

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return children;
}
