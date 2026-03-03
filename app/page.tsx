'use client';

import { useEffect, useState, useCallback } from 'react';
import { Game } from '@/lib/types';
import { GameOdds, KalshiMarket, buildKalshiTicker, buildSpreadEventTicker, matchOdds } from '@/lib/kalshi';
import { GameCard, GameVolume } from '@/components/GameCard';
import { getFavorites } from '@/lib/favorites';
import Link from 'next/link';
import { TeamLogo } from '@/components/TeamLogo';

export default function HomePage() {
  const [games, setGames] = useState<Game[]>([]);
  const [oddsMap, setOddsMap] = useState<Record<string, GameOdds>>({});
  const [volumeMap, setVolumeMap] = useState<Record<string, GameVolume>>({});
  const [loading, setLoading] = useState(true);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [totalChalk, setTotalChalk] = useState(0);
  const [propCount, setPropCount] = useState(0);

  const fetchGames = useCallback(async () => {
    try {
      const [gamesRes, oddsRes] = await Promise.all([
        fetch('/api/games?sport=nba'),
        fetch('/api/odds'),
      ]);
      const gamesData = await gamesRes.json();
      const loadedGames: Game[] = gamesData.games ?? [];
      setGames(loadedGames);

      // Fetch bet volumes
      if (loadedGames.length > 0) {
        const gameIds = loadedGames.map((g) => g.id).join(',');
        fetch(`/api/bets/volume?gameIds=${gameIds}`)
          .then((r) => r.json())
          .then((d) => {
            setVolumeMap(d.volumes ?? {});
            setTotalChalk(d.totalChalk ?? 0);
            setPropCount(d.totalBetCount ?? 0);
          })
          .catch(() => {});
      }

      const oddsData = await oddsRes.json();
      const markets: KalshiMarket[] = oddsData.markets ?? [];
      const spreads: KalshiMarket[] = oddsData.spreads ?? [];
      if (markets.length > 0) {
        const mapped: Record<string, GameOdds> = {};
        for (const game of loadedGames) {
          const d = new Date(game.date);
          const ticker = buildKalshiTicker(d, game.awayTeam.abbreviation, game.homeTeam.abbreviation);
          const spreadTicker = buildSpreadEventTicker(d, game.awayTeam.abbreviation, game.homeTeam.abbreviation);
          mapped[game.id] = matchOdds(markets, ticker, game.awayTeam.abbreviation, game.homeTeam.abbreviation, spreads, spreadTicker);
        }
        setOddsMap(mapped);
      }
    } catch {
      // Keep existing games on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchGames();
    const interval = setInterval(fetchGames, 30000);
    return () => clearInterval(interval);
  }, [fetchGames]);

  const favoriteAbbrs = getFavorites().map((f) => f.abbreviation);
  const filteredGames = showFavoritesOnly
    ? games.filter(
        (g) =>
          favoriteAbbrs.includes(g.homeTeam.abbreviation) ||
          favoriteAbbrs.includes(g.awayTeam.abbreviation)
      )
    : games;

  const liveGames = filteredGames.filter((g) => g.state === 'in');
  const upcomingGames = filteredGames.filter((g) => g.state === 'pre');
  const finalGames = filteredGames.filter((g) => g.state === 'post');
  const liveCount = games.filter((g) => g.state === 'in').length;

  // Pick the featured game: highest volume wagered, preferring live > upcoming
  const getVolume = (g: Game) => volumeMap[g.id]?.total ?? 0;
  const featuredGame = (() => {
    const pool = liveGames.length > 0 ? liveGames : upcomingGames;
    if (pool.length === 0) return null;
    return [...pool].sort((a, b) => getVolume(b) - getVolume(a))[0];
  })();

  const isHeroLive = featuredGame?.state === 'in';
  const remainingLive = featuredGame && isHeroLive
    ? liveGames.filter((g) => g.id !== featuredGame.id)
    : liveGames;
  const remainingUpcoming = featuredGame && !isHeroLive
    ? upcomingGames.filter((g) => g.id !== featuredGame.id)
    : upcomingGames;

  return (
    <div className="home-layout max-w-2xl mx-auto px-4">
      {/* ─── Pinned Header ─── */}
      <div className="home-header pt-6 pb-4">
        {/* Date + Controls */}
        <div className="flex items-end justify-between mb-5 fade-up">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-[11px] uppercase tracking-[0.2em]" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-header)' }}>
                NBA
              </span>
              <span style={{ color: 'var(--dust-medium)' }}>&middot;</span>
              <span className="text-[11px] tracking-wide" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {liveCount > 0 && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] text-xs uppercase tracking-wider"
                style={{ background: 'rgba(245,217,96,0.08)', color: 'var(--color-yellow)', fontFamily: 'var(--font-chalk-header)', border: '1px dashed rgba(245,217,96,0.15)' }}
              >
                <span className="w-1.5 h-1.5 rounded-full live-ring" style={{ background: 'var(--color-yellow)' }} />
                {liveCount} Live
              </span>
            )}
            <button
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              className={`chalk-btn flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] text-sm transition-all duration-200 cursor-pointer ${showFavoritesOnly ? 'chalk-btn-accent' : ''}`}
              style={{ fontFamily: 'var(--font-chalk-body)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill={showFavoritesOnly ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={showFavoritesOnly ? 0 : 2}>
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              Favorites
            </button>
          </div>
        </div>

        {/* Stats Ticker */}
        {!loading && games.length > 0 && (
          <div className="chalk-ticker fade-up fade-up-delay-1">
            <div className="flex items-center justify-between">
              <TickerStat label="Games" value={games.length} />
              <TickerDivider />
              <TickerStat label="Live" value={liveCount} highlight={liveCount > 0} />
              <TickerDivider />
              <TickerStat label="Props" value={propCount} />
              <TickerDivider />
              <TickerStat label="Chalk" value={totalChalk} format />
            </div>
          </div>
        )}
      </div>

      {/* ─── Scrollable Games Area ─── */}
      <div className="home-scroll scrollbar-hide">
        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            <div className="shimmer rounded-[4px] h-[180px] mb-4" />
            {[...Array(3)].map((_, i) => (
              <div key={i} className="shimmer rounded-[4px] h-[88px]" />
            ))}
          </div>
        )}

        {/* No games */}
        {!loading && filteredGames.length === 0 && (
          <div className="text-center py-24 fade-up">
            <div className="chalk-empty-board mx-auto mb-6">
              <div className="chalk-empty-lines">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="chalk-ruled-line" style={{ opacity: 0.3 - i * 0.04 }} />
                ))}
              </div>
              <div className="chalk-empty-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" style={{ color: 'var(--chalk-ghost)' }}>
                  <circle cx="12" cy="12" r="9" strokeDasharray="4 3" />
                  <path d="M12 8v4M12 16h.01" />
                </svg>
              </div>
            </div>
            <p className="text-sm chalk-header" style={{ color: 'var(--chalk-dim)' }}>
              {showFavoritesOnly ? 'No favorite teams playing' : 'Board is clean'}
            </p>
            <p className="text-xs mt-1.5" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
              {showFavoritesOnly
                ? 'None of your favorites have games today'
                : 'Check back later for today\'s slate'}
            </p>
          </div>
        )}

        {/* Featured Hero Game */}
        {!loading && featuredGame && (
          <div className="mb-6 fade-up fade-up-delay-1">
            <FeaturedHero game={featuredGame} odds={oddsMap[featuredGame.id]} volume={volumeMap[featuredGame.id]} />
          </div>
        )}

        {/* Game Sections */}
        {!loading && (
          <div className="space-y-6">
            {remainingLive.length > 0 && (
              <GameSection
                title="Live"
                games={remainingLive}
                oddsMap={oddsMap}
                volumeMap={volumeMap}
                accent="var(--color-yellow)"
                icon={<span className="w-1.5 h-1.5 rounded-full live-ring" style={{ background: 'var(--color-yellow)' }} />}
              />
            )}
            {remainingUpcoming.length > 0 && (
              <GameSection
                title="Upcoming"
                games={remainingUpcoming}
                oddsMap={oddsMap}
                volumeMap={volumeMap}
                accent="var(--chalk-dim)"
                icon={
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--chalk-ghost)' }}>
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                }
              />
            )}
            {finalGames.length > 0 && (
              <GameSection
                title="Final"
                games={finalGames}
                oddsMap={oddsMap}
                volumeMap={volumeMap}
                accent="var(--chalk-ghost)"
                icon={
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--chalk-ghost)' }}>
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                }
              />
            )}
          </div>
        )}

        {/* Chalk Tray */}
        {!loading && games.length > 0 && (
          <div className="chalk-tray fade-up mt-8 mb-4">
            <div className="chalk-tray-dust" />
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Featured Hero Card ─── */
function FeaturedHero({ game, odds, volume }: { game: Game; odds?: GameOdds; volume?: GameVolume }) {
  const hasOdds = odds && odds.away !== null && odds.home !== null;
  const isLive = game.state === 'in';
  const homeLeading = Number(game.homeTeam.score) > Number(game.awayTeam.score);
  const awayLeading = Number(game.awayTeam.score) > Number(game.homeTeam.score);

  const tipoff = new Date(game.date).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <Link href={`/game/${game.id}`} className="block group">
      <div className="hero-card rounded-[4px] overflow-hidden relative">
        {/* Glow accent */}
        <div className="hero-glow" />

        {/* Top bar */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2 relative z-10">
          <div className="flex items-center gap-2">
            {isLive ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: 'var(--color-yellow)' }} />
                  <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: 'var(--color-yellow)' }} />
                </span>
                <span className="text-[10px] uppercase tracking-[0.2em] chalk-header" style={{ color: 'var(--color-yellow)' }}>
                  Live Now
                </span>
              </>
            ) : (
              <>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--chalk-ghost)' }}>
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
                <span className="text-[10px] uppercase tracking-[0.2em] chalk-header" style={{ color: 'var(--chalk-dim)' }}>
                  Up Next
                </span>
              </>
            )}
          </div>
          <span className="text-[10px] tracking-wide" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
            {isLive ? game.shortDetail : tipoff}
          </span>
        </div>

        {/* Matchup */}
        <div className="flex items-center justify-center gap-4 px-5 py-5 relative z-10">
          {/* Away */}
          <div className="flex-1 flex flex-col items-center gap-2.5">
            <TeamLogo logo={game.awayTeam.logo} name={game.awayTeam.displayName} size={52} glow={isLive} />
            <div className="text-center">
              <div className="text-sm chalk-header" style={{ color: isLive && awayLeading ? 'var(--chalk-white)' : 'var(--chalk-dim)' }}>
                {game.awayTeam.abbreviation}
              </div>
            </div>
          </div>

          {/* Score or VS */}
          <div className="flex-shrink-0 text-center">
            {isLive ? (
              <div className="hero-score chalk-score tabular-nums chalk-text-glow" style={{ color: 'var(--chalk-white)' }}>
                {game.awayTeam.score}
                <span className="hero-score-divider mx-3">-</span>
                {game.homeTeam.score}
              </div>
            ) : (
              <div className="hero-score chalk-score" style={{ color: 'var(--chalk-ghost)', opacity: 0.5 }}>
                vs
              </div>
            )}
          </div>

          {/* Home */}
          <div className="flex-1 flex flex-col items-center gap-2.5">
            <TeamLogo logo={game.homeTeam.logo} name={game.homeTeam.displayName} size={52} glow={isLive} />
            <div className="text-center">
              <div className="text-sm chalk-header" style={{ color: isLive && homeLeading ? 'var(--chalk-white)' : 'var(--chalk-dim)' }}>
                {game.homeTeam.abbreviation}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar: odds + actions */}
        <div className="relative z-10 px-5 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {hasOdds && (
              <div className="flex items-center gap-2 text-[10px]" style={{ fontFamily: 'var(--font-chalk-body)' }}>
                <span style={{ color: odds.away! > odds.home! ? 'var(--color-green)' : 'var(--chalk-ghost)' }} className="tabular-nums chalk-header">
                  {game.awayTeam.abbreviation} {odds.away}%
                </span>
                <span style={{ color: 'var(--dust-medium)' }}>/</span>
                <span style={{ color: odds.home! > odds.away! ? 'var(--color-green)' : 'var(--chalk-ghost)' }} className="tabular-nums chalk-header">
                  {game.homeTeam.abbreviation} {odds.home}%
                </span>
                {odds.spread && (
                  <>
                    <span style={{ color: 'var(--dust-medium)' }}>&middot;</span>
                    <span className="tabular-nums chalk-header" style={{ color: 'var(--color-blue)' }}>
                      {odds.spread.team} -{odds.spread.line}
                    </span>
                  </>
                )}
              </div>
            )}
            {volume && volume.total > 0 && (
              <span className="flex items-center gap-1 text-[10px] tabular-nums" style={{ color: 'var(--color-yellow)', fontFamily: 'var(--font-chalk-body)' }}>
                <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" opacity="0.6"><circle cx="12" cy="12" r="10" /></svg>
                {formatChalk(volume.total)} chalk
              </span>
            )}
          </div>
          <span
            className="hero-watch-btn flex items-center gap-1.5 px-4 py-2 rounded-[4px] text-sm cursor-pointer"
            style={{ fontFamily: 'var(--font-chalk-header)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Watch
          </span>
        </div>

        {/* Chalk dust edge */}
        <div className="hero-dust-edge" />
      </div>
    </Link>
  );
}

/* ─── Section ─── */
function GameSection({ title, games, oddsMap, volumeMap, accent, icon }: {
  title: string;
  games: Game[];
  oddsMap: Record<string, GameOdds>;
  volumeMap: Record<string, GameVolume>;
  accent: string;
  icon: React.ReactNode;
}) {
  return (
    <section className="fade-up">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex items-center gap-2">
          {icon}
          <span className="section-label">{title}</span>
          <span className="text-[10px] tabular-nums chalk-header" style={{ color: accent, opacity: 0.6 }}>
            {games.length}
          </span>
        </div>
        <div className="flex-1 chalk-ruled-line" style={{ opacity: 0.3 }} />
      </div>
      <div className="space-y-2.5">
        {games.map((game, i) => (
          <div key={game.id} className={`fade-up fade-up-delay-${Math.min(i + 1, 3)}`}>
            <GameCard game={game} odds={oddsMap[game.id]} volume={volumeMap[game.id]} />
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── Ticker Stat ─── */
function TickerStat({ label, value, highlight, format }: { label: string; value: number; highlight?: boolean; format?: boolean }) {
  const display = format ? formatChalk(value) : value.toString();
  return (
    <div className="flex flex-col items-center gap-0.5 flex-1">
      <span
        className="text-lg tabular-nums chalk-score"
        style={{ color: highlight ? 'var(--color-yellow)' : 'var(--chalk-white)' }}
      >
        {display}
      </span>
      <span className="text-[9px] uppercase tracking-[0.15em]" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-header)' }}>
        {label}
      </span>
    </div>
  );
}

function TickerDivider() {
  return (
    <div className="w-px h-7 chalk-ticker-divider" />
  );
}

function formatChalk(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return n.toString();
}
