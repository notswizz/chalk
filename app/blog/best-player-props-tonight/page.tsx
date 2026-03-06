import { Metadata } from 'next';
import Link from 'next/link';
import { fetchAllGames } from '@/lib/espn';

export const metadata: Metadata = {
  title: 'Best NBA Player Props Tonight — Daily Picks & Betting Analysis',
  description: 'Find the best NBA player prop bets for tonight\'s games. Over/under picks for points, rebounds, assists, and 3-pointers. Free player prop betting on Chalk — the best StreamEast and Buffstreams alternative.',
  keywords: [
    'best NBA player props tonight', 'NBA props today', 'player props tonight',
    'NBA player props picks', 'best player props today', 'NBA over under today',
    'NBA points props', 'NBA rebounds props', 'NBA assists props',
    'NBA betting picks today', 'free NBA props', 'NBA prop bets tonight',
    'tonight NBA picks', 'NBA games tonight props',
  ],
  openGraph: {
    title: 'Best NBA Player Props Tonight | Chalk',
    description: 'Tonight\'s best NBA player prop picks — points, rebounds, assists, 3-pointers. Free betting on Chalk.',
    type: 'article',
  },
};

export default async function BestPropsTonight() {
  let games: { id: string; awayTeam: { abbreviation: string; displayName: string }; homeTeam: { abbreviation: string; displayName: string }; state: string; date: string }[] = [];
  try {
    games = await fetchAllGames();
  } catch {
    // no games
  }

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <article className="prose-chalk">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: `Best NBA Player Props Tonight — ${today}`,
            description: 'Daily NBA player prop picks and analysis for tonight\'s games.',
            author: { '@type': 'Organization', name: 'Chalk' },
            publisher: { '@type': 'Organization', name: 'Chalk', url: 'https://chalkstreams.live' },
            mainEntityOfPage: 'https://chalkstreams.live/blog/best-player-props-tonight',
            datePublished: new Date().toISOString().split('T')[0],
            dateModified: new Date().toISOString().split('T')[0],
          }),
        }}
      />

      <Link href="/blog" className="text-xs mb-6 inline-block" style={{ color: 'var(--chalk-ghost)' }}>
        &larr; Back to Blog
      </Link>

      <h1 className="text-2xl chalk-header chalk-text mb-3" style={{ color: 'var(--chalk-white)' }}>
        Best NBA Player Props Tonight
      </h1>
      <p className="text-xs mb-6" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
        {today} — Updated daily
      </p>

      <div className="space-y-6 text-sm" style={{ color: 'var(--chalk-dim)', fontFamily: 'var(--font-chalk-body)', lineHeight: '1.8' }}>
        <p>
          Looking for the <strong style={{ color: 'var(--chalk-white)' }}>best NBA player props tonight</strong>? Chalk is the only platform where you can watch free NBA streams AND bet on player props at the same time. No sportsbook account needed — just sign up free and start betting with CHALK tokens.
        </p>

        <h2 className="text-lg chalk-header mt-8 mb-3" style={{ color: 'var(--chalk-white)' }}>
          Tonight&apos;s NBA Games
        </h2>

        {games.length > 0 ? (
          <div className="space-y-3">
            {games.filter(g => g.state !== 'post').map((game) => {
              const tipoff = new Date(game.date).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
                timeZone: 'America/New_York',
              });
              return (
                <Link key={game.id} href={`/game/${game.id}`} className="block group">
                  <div className="chalk-card p-4 rounded-[4px] flex items-center justify-between transition-all hover:brightness-110">
                    <div>
                      <span className="text-sm chalk-header" style={{ color: 'var(--chalk-white)' }}>
                        {game.awayTeam.abbreviation} vs {game.homeTeam.abbreviation}
                      </span>
                      <span className="text-xs ml-2" style={{ color: 'var(--chalk-ghost)' }}>
                        {game.state === 'in' ? 'LIVE' : tipoff + ' ET'}
                      </span>
                    </div>
                    <span className="text-xs chalk-header group-hover:text-[var(--color-yellow)] transition-colors" style={{ color: 'var(--chalk-ghost)' }}>
                      Bet Props &rarr;
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <p style={{ color: 'var(--chalk-ghost)' }}>No NBA games scheduled tonight. Check back tomorrow.</p>
        )}

        <h2 className="text-lg chalk-header mt-8 mb-3" style={{ color: 'var(--chalk-white)' }}>
          How Player Props Work on Chalk
        </h2>

        <p>
          Player props let you bet on individual player stat lines — not the game outcome. Pick a player, choose a stat (points, rebounds, assists, or 3-pointers), set an over/under target, and put up your stake in CHALK tokens.
        </p>

        <div className="chalk-card p-4 rounded-[4px] space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-lg" style={{ color: 'var(--color-yellow)' }}>1</span>
            <div>
              <strong style={{ color: 'var(--chalk-white)' }}>Draw up a prop</strong>
              <p className="text-xs mt-0.5" style={{ color: 'var(--chalk-ghost)' }}>Pick a player, stat, and over/under target. Example: &quot;LeBron over 27.5 points&quot;</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-lg" style={{ color: 'var(--color-yellow)' }}>2</span>
            <div>
              <strong style={{ color: 'var(--chalk-white)' }}>Someone takes the other side</strong>
              <p className="text-xs mt-0.5" style={{ color: 'var(--chalk-ghost)' }}>Your prop goes on the board. Another user accepts and takes the opposite side.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-lg" style={{ color: 'var(--color-yellow)' }}>3</span>
            <div>
              <strong style={{ color: 'var(--chalk-white)' }}>Auto-graded from ESPN</strong>
              <p className="text-xs mt-0.5" style={{ color: 'var(--chalk-ghost)' }}>When the game ends, results are pulled from ESPN box scores. Winner takes the pot.</p>
            </div>
          </div>
        </div>

        <h2 className="text-lg chalk-header mt-8 mb-3" style={{ color: 'var(--chalk-white)' }}>
          Popular Player Prop Categories
        </h2>

        <ul className="space-y-2 pl-4">
          <li><strong style={{ color: 'var(--color-yellow)' }}>Points</strong> — The most popular prop. Will the player score over or under the line?</li>
          <li><strong style={{ color: 'var(--color-yellow)' }}>Rebounds</strong> — Big men and versatile forwards. Centers and PFs tend to be the targets.</li>
          <li><strong style={{ color: 'var(--color-yellow)' }}>Assists</strong> — Point guards and playmakers. Great for targeting pass-first players.</li>
          <li><strong style={{ color: 'var(--color-yellow)' }}>3-Pointers Made</strong> — Sharpshooters and volume shooters. High variance, high excitement.</li>
        </ul>

        <h2 className="text-lg chalk-header mt-8 mb-3" style={{ color: 'var(--chalk-white)' }}>
          Tips for Winning Player Prop Bets
        </h2>

        <ul className="space-y-2 pl-4">
          <li><strong style={{ color: 'var(--chalk-white)' }}>Check injury reports</strong> — When a star is out, role players see more usage.</li>
          <li><strong style={{ color: 'var(--chalk-white)' }}>Look at matchups</strong> — Some teams give up more points to guards, others to bigs.</li>
          <li><strong style={{ color: 'var(--chalk-white)' }}>Recent form matters</strong> — A player on a hot streak is more likely to stay hot.</li>
          <li><strong style={{ color: 'var(--chalk-white)' }}>Pace of play</strong> — Fast-paced games mean more possessions and higher stats.</li>
          <li><strong style={{ color: 'var(--chalk-white)' }}>Home vs away</strong> — Some players perform significantly better at home.</li>
        </ul>

        <div className="mt-10 p-5 rounded-[4px] text-center" style={{ background: 'rgba(245,217,96,0.06)', border: '1px dashed rgba(245,217,96,0.15)' }}>
          <p className="chalk-header text-base mb-2" style={{ color: 'var(--color-yellow)' }}>
            Ready to bet props?
          </p>
          <p className="text-xs mb-4" style={{ color: 'var(--chalk-ghost)' }}>
            Sign up free and get 500 CHALK tokens.
          </p>
          <Link
            href="/bets"
            className="inline-block px-6 py-2.5 rounded-[4px] chalk-header text-sm transition-all"
            style={{ background: 'var(--color-yellow)', color: '#1a2a1a' }}
          >
            See Tonight&apos;s Props
          </Link>
        </div>
      </div>
    </article>
  );
}
