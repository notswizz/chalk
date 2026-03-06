import { Metadata } from 'next';

const SPORT_NAMES: Record<string, string> = {
  nba: 'NBA',
  nfl: 'NFL',
  mlb: 'MLB',
  nhl: 'NHL',
  soccer: 'Soccer',
  ncaab: 'NCAAB',
};

const SPORT_KEYWORDS: Record<string, string[]> = {
  nba: ['NBA streams free', 'watch NBA live', 'NBA live stream', 'free NBA streaming', 'NBA games tonight', 'NBA scores today', 'NBA player props', 'basketball streams'],
  nfl: ['NFL streams free', 'watch NFL live', 'NFL live stream', 'free NFL streaming', 'NFL games today', 'football streams'],
  mlb: ['MLB streams free', 'watch MLB live', 'MLB live stream', 'free MLB streaming', 'baseball streams'],
  nhl: ['NHL streams free', 'watch NHL live', 'NHL live stream', 'free NHL streaming', 'hockey streams'],
  soccer: ['soccer streams free', 'watch soccer live', 'football live stream', 'free soccer streaming'],
  ncaab: ['NCAAB streams free', 'college basketball streams', 'March Madness streams', 'NCAAB live stream'],
};

export async function generateMetadata({ params }: { params: Promise<{ sport: string }> }): Promise<Metadata> {
  const { sport } = await params;
  const name = SPORT_NAMES[sport] || sport.toUpperCase();
  const title = `${name} Live Streams — Free ${name} Games & Player Props`;
  const description = `Watch free live ${name} streams with real-time scores and player prop betting on Chalk. The best StreamEast and Buffstreams alternative for ${name} games. Live scores, stats, and player props.`;

  return {
    title,
    description,
    keywords: SPORT_KEYWORDS[sport] || [`${name} streams`, `watch ${name} live`],
    openGraph: {
      title: `${name} Live Streams & Player Props | Chalk`,
      description: `Watch free live ${name} streams with player prop betting on Chalk.`,
    },
  };
}

export default function SportLayout({ children }: { children: React.ReactNode }) {
  return children;
}
