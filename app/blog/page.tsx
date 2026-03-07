import { Metadata } from 'next';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Blog — Free NBA Streams & Player Prop Betting Guides',
  description: 'Learn how to watch NBA games free online, find the best player props tonight, and discover the top StreamEast and Buffstreams alternatives for live sports streaming.',
  keywords: ['free NBA streams', 'how to watch NBA free', 'streameast alternative', 'buffstreams alternative', 'NBA player props', 'best player props tonight'],
};

const posts = [
  {
    slug: 'how-to-watch-nba-free',
    title: 'How to Watch NBA Games Free Online in 2026',
    description: 'The complete guide to watching live NBA streams for free. No cable needed — just open Chalk and start watching.',
    tag: 'Guide',
  },
  {
    slug: 'best-player-props-tonight',
    title: 'Best NBA Player Props Tonight — Daily Picks & Analysis',
    description: 'Find the sharpest player prop bets for tonight\'s NBA games. Points, rebounds, assists, and 3-pointers — updated daily.',
    tag: 'Daily',
  },
  {
    slug: 'streameast-alternatives',
    title: 'Best StreamEast & Buffstreams Alternatives in 2026',
    description: 'Looking for a StreamEast or Buffstreams alternative? Chalk offers free live NBA streams with player prop betting — no ads, no popups.',
    tag: 'Guide',
  },
];

export default function BlogIndex() {
  return (
    <>
      <h1 className="text-2xl chalk-header chalk-text mb-2" style={{ color: 'var(--chalk-white)' }}>
        Chalk Blog
      </h1>
      <p className="text-sm mb-8" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
        Guides, tips, and analysis for free NBA streaming and player prop betting.
      </p>
      <div className="space-y-4">
        {posts.map((post) => (
          <Link key={post.slug} href={`/blog/${post.slug}`} className="block group">
            <article className="chalk-card p-5 rounded-[4px] transition-all duration-200 hover:brightness-110">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[9px] uppercase tracking-[0.2em] px-2 py-0.5 rounded-[2px] chalk-header"
                  style={{ background: 'rgba(245,217,96,0.1)', color: 'var(--color-yellow)' }}
                >
                  {post.tag}
                </span>
              </div>
              <h2 className="text-base chalk-header mb-1 group-hover:text-[var(--color-yellow)] transition-colors" style={{ color: 'var(--chalk-dim)' }}>
                {post.title}
              </h2>
              <p className="text-xs" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
                {post.description}
              </p>
            </article>
          </Link>
        ))}
      </div>
    </>
  );
}
