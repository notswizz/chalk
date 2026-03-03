import { Metadata } from 'next';

const SPORT_NAMES: Record<string, string> = {
  nba: 'NBA',
  nfl: 'NFL',
  mlb: 'MLB',
  nhl: 'NHL',
  soccer: 'Soccer',
  ncaab: 'NCAAB',
};

export async function generateMetadata({ params }: { params: Promise<{ sport: string }> }): Promise<Metadata> {
  const { sport } = await params;
  const name = SPORT_NAMES[sport] || sport.toUpperCase();
  const title = `${name} Games`;
  const description = `Watch live ${name} games and bet on player props with CHALK.`;

  return {
    title,
    description,
    openGraph: { title: `${title} | Chalk`, description },
  };
}

export default function SportLayout({ children }: { children: React.ReactNode }) {
  return children;
}
