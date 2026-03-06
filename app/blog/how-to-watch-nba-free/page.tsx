import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'How to Watch NBA Games Free Online in 2026 — Complete Guide',
  description: 'Watch free live NBA streams on Chalk — no cable, no signup, no ads. The best free NBA streaming site with live scores, player stats, and player prop betting. Better than StreamEast, Buffstreams, and Crackstreams.',
  keywords: [
    'how to watch NBA games free', 'free NBA streams', 'watch NBA online free',
    'NBA live stream free', 'free NBA streaming sites', 'watch NBA without cable',
    'NBA streams reddit', 'streameast', 'buffstreams', 'crackstreams',
    'sportsurge', 'nba streams free 2026', 'watch basketball free online',
    'how to watch NBA games without cable', 'free sports streaming',
  ],
  openGraph: {
    title: 'How to Watch NBA Games Free Online | Chalk',
    description: 'Watch free live NBA streams with player prop betting. No cable, no ads, no signup.',
    type: 'article',
  },
};

export default function HowToWatchNBAFree() {
  return (
    <article className="prose-chalk">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: 'How to Watch NBA Games Free Online in 2026',
            description: 'Complete guide to watching free live NBA streams with player prop betting on Chalk.',
            author: { '@type': 'Organization', name: 'Chalk' },
            publisher: { '@type': 'Organization', name: 'Chalk', url: 'https://chalkstreams.live' },
            mainEntityOfPage: 'https://chalkstreams.live/blog/how-to-watch-nba-free',
            datePublished: '2026-01-01',
            dateModified: new Date().toISOString().split('T')[0],
          }),
        }}
      />

      <Link href="/blog" className="text-xs mb-6 inline-block" style={{ color: 'var(--chalk-ghost)' }}>
        &larr; Back to Blog
      </Link>

      <h1 className="text-2xl chalk-header chalk-text mb-3" style={{ color: 'var(--chalk-white)' }}>
        How to Watch NBA Games Free Online in 2026
      </h1>
      <p className="text-xs mb-6" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
        Updated March 2026
      </p>

      <div className="space-y-6 text-sm" style={{ color: 'var(--chalk-dim)', fontFamily: 'var(--font-chalk-body)', lineHeight: '1.8' }}>
        <p>
          Looking for <strong style={{ color: 'var(--chalk-white)' }}>free NBA streams</strong>? You&apos;re not alone. Every night, millions of basketball fans search for ways to watch NBA games online without paying for cable or League Pass. Sites like StreamEast, Buffstreams, and Crackstreams used to be the go-to options, but they&apos;re unreliable, full of ads, and constantly getting taken down.
        </p>

        <p>
          <strong style={{ color: 'var(--chalk-white)' }}>Chalk is different.</strong> It&apos;s a free live sports streaming platform built for fans who want more than just a stream. You get live scores, real-time player stats, and the ability to bet on player props — all while watching the game.
        </p>

        <h2 className="text-lg chalk-header mt-8 mb-3" style={{ color: 'var(--chalk-white)' }}>
          Why Chalk Is the Best Free NBA Streaming Site
        </h2>

        <ul className="space-y-2 pl-4">
          <li><strong style={{ color: 'var(--color-yellow)' }}>Free NBA streams</strong> — Watch every NBA game live, no cable or subscription required.</li>
          <li><strong style={{ color: 'var(--color-yellow)' }}>No ads, no popups</strong> — Clean, fast interface. No sketchy redirects or malware.</li>
          <li><strong style={{ color: 'var(--color-yellow)' }}>Live scores & stats</strong> — Real-time box scores powered by ESPN data.</li>
          <li><strong style={{ color: 'var(--color-yellow)' }}>Player prop betting</strong> — Bet on points, rebounds, assists, and 3-pointers during live games.</li>
          <li><strong style={{ color: 'var(--color-yellow)' }}>Game clips</strong> — Clip and share highlights as they happen.</li>
          <li><strong style={{ color: 'var(--color-yellow)' }}>Live chat</strong> — Talk trash and celebrate with other fans in real-time.</li>
          <li><strong style={{ color: 'var(--color-yellow)' }}>Leaderboards</strong> — Compete with the best prop bettors on the platform.</li>
        </ul>

        <h2 className="text-lg chalk-header mt-8 mb-3" style={{ color: 'var(--chalk-white)' }}>
          How to Watch NBA Games Free on Chalk
        </h2>

        <ol className="space-y-3 pl-4">
          <li><strong style={{ color: 'var(--chalk-white)' }}>1. Go to chalkstreams.live</strong> — Open the site on any device (phone, tablet, desktop).</li>
          <li><strong style={{ color: 'var(--chalk-white)' }}>2. Pick a game</strong> — Today&apos;s NBA slate is on the homepage with live scores and tip-off times.</li>
          <li><strong style={{ color: 'var(--chalk-white)' }}>3. Watch free</strong> — Click any game to start watching. Multiple stream sources available.</li>
          <li><strong style={{ color: 'var(--chalk-white)' }}>4. Bet on props</strong> — Sign up free, get 500 CHALK tokens, and start betting on player stats.</li>
        </ol>

        <h2 className="text-lg chalk-header mt-8 mb-3" style={{ color: 'var(--chalk-white)' }}>
          Chalk vs StreamEast vs Buffstreams
        </h2>

        <div className="chalk-card p-4 rounded-[4px] overflow-x-auto">
          <table className="w-full text-xs" style={{ fontFamily: 'var(--font-chalk-body)' }}>
            <thead>
              <tr style={{ borderBottom: '1px dashed var(--dust-light)' }}>
                <th className="text-left py-2 pr-4 chalk-header" style={{ color: 'var(--chalk-ghost)' }}>Feature</th>
                <th className="text-center py-2 px-3 chalk-header" style={{ color: 'var(--color-yellow)' }}>Chalk</th>
                <th className="text-center py-2 px-3 chalk-header" style={{ color: 'var(--chalk-ghost)' }}>StreamEast</th>
                <th className="text-center py-2 px-3 chalk-header" style={{ color: 'var(--chalk-ghost)' }}>Buffstreams</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Free NBA Streams', true, true, true],
                ['No Ads / Popups', true, false, false],
                ['Live Scores', true, false, false],
                ['Player Props Betting', true, false, false],
                ['Live Chat', true, false, false],
                ['Game Clips', true, false, false],
                ['Leaderboards', true, false, false],
                ['Mobile Friendly', true, 'Partial', 'Partial'],
              ].map(([feature, chalk, se, bs], i) => (
                <tr key={i} style={{ borderBottom: '1px dashed var(--dust-light)' }}>
                  <td className="py-2 pr-4" style={{ color: 'var(--chalk-dim)' }}>{feature as string}</td>
                  <td className="text-center py-2 px-3" style={{ color: chalk === true ? 'var(--color-green)' : 'var(--chalk-ghost)' }}>
                    {chalk === true ? '\u2713' : chalk === false ? '\u2717' : chalk as string}
                  </td>
                  <td className="text-center py-2 px-3" style={{ color: se === true ? 'var(--color-green)' : 'var(--chalk-ghost)' }}>
                    {se === true ? '\u2713' : se === false ? '\u2717' : se as string}
                  </td>
                  <td className="text-center py-2 px-3" style={{ color: bs === true ? 'var(--color-green)' : 'var(--chalk-ghost)' }}>
                    {bs === true ? '\u2713' : bs === false ? '\u2717' : bs as string}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="text-lg chalk-header mt-8 mb-3" style={{ color: 'var(--chalk-white)' }}>
          What Are NBA Player Props?
        </h2>

        <p>
          Player props are bets on individual player performances — not the game outcome. On Chalk, you can bet on whether a player will go <strong style={{ color: 'var(--chalk-white)' }}>over or under</strong> a stat line for points, rebounds, assists, or 3-pointers made.
        </p>
        <p>
          For example: &quot;LeBron James over 25.5 points&quot; or &quot;Steph Curry under 4.5 threes.&quot; You set a stake, someone takes the other side, and results are graded automatically from ESPN box scores when the game ends.
        </p>

        <h2 className="text-lg chalk-header mt-8 mb-3" style={{ color: 'var(--chalk-white)' }}>
          Frequently Asked Questions
        </h2>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm chalk-header mb-1" style={{ color: 'var(--chalk-white)' }}>Is Chalk really free?</h3>
            <p>Yes. Chalk is 100% free. You get 500 CHALK tokens on signup to start betting on player props. No credit card needed.</p>
          </div>
          <div>
            <h3 className="text-sm chalk-header mb-1" style={{ color: 'var(--chalk-white)' }}>Do I need to sign up to watch?</h3>
            <p>No. You can watch any NBA game without signing up. You only need an account to bet on player props and use the chat.</p>
          </div>
          <div>
            <h3 className="text-sm chalk-header mb-1" style={{ color: 'var(--chalk-white)' }}>What NBA games are on tonight?</h3>
            <p>Check the <Link href="/" style={{ color: 'var(--color-yellow)' }}>Chalk homepage</Link> for tonight&apos;s full NBA slate with tip-off times, odds, and live scores.</p>
          </div>
          <div>
            <h3 className="text-sm chalk-header mb-1" style={{ color: 'var(--chalk-white)' }}>Is Chalk better than StreamEast?</h3>
            <p>Chalk offers a cleaner experience with no ads, plus features StreamEast doesn&apos;t have: live scores, player prop betting, game clips, and leaderboards.</p>
          </div>
        </div>

        <div className="mt-10 p-5 rounded-[4px] text-center" style={{ background: 'rgba(245,217,96,0.06)', border: '1px dashed rgba(245,217,96,0.15)' }}>
          <p className="chalk-header text-base mb-2" style={{ color: 'var(--color-yellow)' }}>
            Ready to watch?
          </p>
          <p className="text-xs mb-4" style={{ color: 'var(--chalk-ghost)' }}>
            See what&apos;s on the board tonight.
          </p>
          <Link
            href="/"
            className="inline-block px-6 py-2.5 rounded-[4px] chalk-header text-sm transition-all"
            style={{ background: 'var(--color-yellow)', color: '#1a2a1a' }}
          >
            Watch NBA Free
          </Link>
        </div>
      </div>
    </article>
  );
}
