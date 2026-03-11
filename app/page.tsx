'use client';
// Trigger deploy
import { useEffect, useState, useCallback, useRef } from 'react';
import { Game, ROUND_LABELS, TournamentRound } from '@/lib/types';
import { GameOdds, KalshiMarket, buildKalshiTicker, buildSpreadEventTicker, matchOdds } from '@/lib/kalshi';
import { GameCard, GameVolume } from '@/components/GameCard';
import { getFavorites } from '@/lib/favorites';
import Link from 'next/link';
import { TeamLogo } from '@/components/TeamLogo';
import { useSport, setSport } from '@/components/SportSelector';

export const dynamic = 'force-dynamic';

interface Clip {
  id: string;
  clipTitle?: string;
  userName?: string;
  gameTitle?: string;
  url: string;
  createdAt: number;
}

export default function HomePage() {
  const sport = useSport();
  const [games, setGames] = useState<Game[]>([]);
  const [oddsMap, setOddsMap] = useState<Record<string, GameOdds>>({});
  const [volumeMap, setVolumeMap] = useState<Record<string, GameVolume>>({});
  const [roundMap, setRoundMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [totalChalk, setTotalChalk] = useState(0);
  const [propCount, setPropCount] = useState(0);
  const [clips, setClips] = useState<Clip[]>([]);

  const fetchGames = useCallback(async () => {
    try {
      const [gamesRes, oddsRes] = await Promise.all([
        fetch(`/api/games?sport=${sport}`),
        sport === 'nba' ? fetch('/api/odds') : Promise.resolve(new Response(JSON.stringify({}))),
      ]);
      const gamesData = await gamesRes.json();
      const loadedGames: Game[] = gamesData.games ?? [];
      setGames(loadedGames);
      if (gamesData.roundMap) setRoundMap(gamesData.roundMap);

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

      if (sport === 'nba') {
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
      } else {
        setOddsMap({});
      }
    } catch {
      // Keep existing games on error
    } finally {
      setLoading(false);
    }
  }, [sport]);

  useEffect(() => {
    setLoading(true);
    setGames([]);
    setOddsMap({});
    setRoundMap({});
    fetchGames();
    const interval = setInterval(fetchGames, 30000);
    return () => clearInterval(interval);
  }, [fetchGames]);

  useEffect(() => {
    fetch('/api/clips')
      .then((r) => r.json())
      .then((d) => setClips((d.clips ?? []).slice(0, 4)))
      .catch(() => {});
  }, []);

  const favoriteAbbrs = getFavorites().map((f) => f.abbreviation);
  const searchFiltered = searchQuery.trim()
    ? games.filter((g) => {
        const q = searchQuery.trim().toLowerCase();
        return (
          g.homeTeam.displayName.toLowerCase().includes(q) ||
          g.awayTeam.displayName.toLowerCase().includes(q) ||
          g.homeTeam.abbreviation.toLowerCase().includes(q) ||
          g.awayTeam.abbreviation.toLowerCase().includes(q)
        );
      })
    : games;
  const filteredGames = showFavoritesOnly
    ? searchFiltered.filter(
        (g) =>
          favoriteAbbrs.includes(g.homeTeam.abbreviation) ||
          favoriteAbbrs.includes(g.awayTeam.abbreviation)
      )
    : searchFiltered;

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

  const leftClips = clips.slice(0, 2);
  const rightClips = clips.slice(2, 4);

  return (
    <div className="home-with-clips">
      {/* Left clip rail */}
      {clips.length > 0 && (
        <div className="clip-rail clip-rail-left">

          {leftClips.map((clip) => (
            <ClipCard key={clip.id} clip={clip} />
          ))}
        </div>
      )}

    <div className="home-layout max-w-3xl mx-auto px-4">
      {/* ─── Pinned Header ─── */}
      <div className="home-header pt-6 pb-4">
        {/* Sport Toggle */}
        <div className="flex items-center justify-center mb-4 fade-up">
          <div
            className="flex items-center gap-1 p-1 rounded-[6px]"
            style={{ background: 'var(--dust-light)', border: '1px dashed var(--dust-medium)' }}
          >
            <button
              onClick={() => setSport('nba')}
              className="px-5 py-2 rounded-[5px] text-sm font-bold tracking-wide transition-all duration-200 cursor-pointer"
              style={{
                fontFamily: 'var(--font-chalk-header)',
                background: sport === 'nba' ? 'rgba(245,217,96,0.15)' : 'transparent',
                color: sport === 'nba' ? 'var(--color-yellow)' : 'var(--chalk-ghost)',
                border: sport === 'nba' ? '1px solid rgba(245,217,96,0.25)' : '1px solid transparent',
              }}
            >
              NBA
            </button>
            <button
              onClick={() => setSport('ncaam')}
              className="px-5 py-2 rounded-[5px] text-sm font-bold tracking-wide transition-all duration-200 cursor-pointer"
              style={{
                fontFamily: 'var(--font-chalk-header)',
                background: sport === 'ncaam' ? 'rgba(245,217,96,0.15)' : 'transparent',
                color: sport === 'ncaam' ? 'var(--color-yellow)' : 'var(--chalk-ghost)',
                border: sport === 'ncaam' ? '1px solid rgba(245,217,96,0.25)' : '1px solid transparent',
              }}
            >
              NCAA
            </button>
          </div>
        </div>

        {/* Date + Controls */}
        <div className="flex items-end justify-between mb-5 fade-up">
          <div>
            <span className="text-[11px] tracking-wide" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </span>
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
        {!loading && (
          <div className="chalk-ticker-premium fade-up fade-up-delay-1">
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

        {/* Search bar */}
        {!loading && games.length > 0 && (
          <div className="mt-3 fade-up fade-up-delay-1">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                style={{ color: 'var(--chalk-ghost)' }}
              >
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search teams..."
                className="w-full rounded-[4px] py-2 pl-9 pr-3 text-sm outline-none"
                style={{
                  background: 'rgba(232,228,217,0.04)',
                  border: '1px dashed rgba(232,228,217,0.1)',
                  color: 'var(--chalk-white)',
                  fontFamily: 'var(--font-chalk-body)',
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded cursor-pointer"
                  style={{ color: 'var(--chalk-ghost)' }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              )}
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
            <div className="chalk-empty-board-enhanced mx-auto mb-6">
              <div className="chalk-dust-settle">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="chalk-dust-particle" style={{
                    left: `${10 + (i * 7) % 80}%`,
                    animationDelay: `${i * 0.3}s`,
                    animationDuration: `${2 + (i % 3)}s`,
                  }} />
                ))}
              </div>
              <div className="chalk-empty-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ color: 'var(--chalk-ghost)' }}>
                  <circle cx="12" cy="12" r="9" strokeDasharray="4 3" />
                  <path d="M12 8v4M12 16h.01" />
                </svg>
              </div>
            </div>
            <p className="text-base chalk-header" style={{ color: 'var(--chalk-dim)' }}>
              {showFavoritesOnly ? 'No favorite teams playing' : 'Board is clean'}
            </p>
            <p className="text-sm mt-2" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
              {showFavoritesOnly
                ? 'None of your favorites have games today'
                : 'Check back later for today\'s slate'}
            </p>
          </div>
        )}

        {/* Featured Hero Game */}
        {!loading && featuredGame && (
          <div className="mb-6 fade-up fade-up-delay-3">
            <FeaturedHero game={featuredGame} odds={oddsMap[featuredGame.id]} volume={volumeMap[featuredGame.id]} />
          </div>
        )}

        {/* Game Sections */}
        {!loading && (
          <div className="space-y-8">
            {/* Tournament round sections for NCAA */}
            {sport === 'ncaam' && Object.keys(roundMap).length > 0 ? (
              (() => {
                // Group games by tournament round
                const roundGroups: Record<string, Game[]> = {};
                const nonTournament: Game[] = [];
                for (const game of filteredGames) {
                  const round = roundMap[game.id];
                  if (round) {
                    if (!roundGroups[round]) roundGroups[round] = [];
                    roundGroups[round].push(game);
                  } else {
                    nonTournament.push(game);
                  }
                }
                const roundOrder = ['round_of_64', 'round_of_32', 'sweet_16', 'elite_eight', 'final_four', 'championship'];
                return (
                  <>
                    {roundOrder.map((round) => {
                      const rGames = roundGroups[round];
                      if (!rGames || rGames.length === 0) return null;
                      return (
                        <GameSection
                          key={round}
                          title={ROUND_LABELS[round as TournamentRound] ?? round}
                          games={rGames}
                          oddsMap={oddsMap}
                          volumeMap={volumeMap}
                          accent="var(--color-yellow)"
                          icon={<span className="text-xs">🏆</span>}
                        />
                      );
                    })}
                    {nonTournament.length > 0 && (
                      <GameSection
                        title="Other Games"
                        games={nonTournament}
                        oddsMap={oddsMap}
                        volumeMap={volumeMap}
                        accent="var(--chalk-ghost)"
                        icon={
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--chalk-ghost)' }}>
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 6v6l4 2" />
                          </svg>
                        }
                      />
                    )}
                  </>
                );
              })()
            ) : (
              <>
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
              </>
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

      {/* Right clip rail */}
      {clips.length > 2 && (
        <div className="clip-rail clip-rail-right">

          {rightClips.map((clip) => (
            <ClipCard key={clip.id} clip={clip} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Clip Card for side rails ─── */
function ClipCard({ clip }: { clip: Clip }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <Link
      href="/clips"
      className="clip-rail-card group"
      onMouseEnter={() => { videoRef.current?.play(); setIsPlaying(true); }}
      onMouseLeave={() => { videoRef.current?.pause(); setIsPlaying(false); }}
    >
      <div className="clip-rail-video-wrap">
        <video
          ref={videoRef}
          src={clip.url}
          muted
          loop
          playsInline
          preload="metadata"
        />
        {!isPlaying && (
          <div className="clip-rail-play">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
        )}
      </div>
      <div className="clip-rail-info">
        <span className="clip-rail-title">{clip.clipTitle || 'Untitled Clip'}</span>
        <span className="clip-rail-meta">{clip.userName || 'User'}</span>
      </div>
    </Link>
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
        {/* Glow accent — animated */}
        <div className="hero-glow-animated" />

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
        <div className="flex items-center justify-center gap-4 px-5 py-7 relative z-10">
          {/* Away */}
          <div className="flex-1 flex flex-col items-center gap-3">
            <TeamLogo logo={game.awayTeam.logo} name={game.awayTeam.displayName} size={72} glow={isLive} />
            <div className="text-center">
              <div className="text-base chalk-header" style={{ color: isLive && awayLeading ? 'var(--chalk-white)' : 'var(--chalk-dim)' }}>
                {game.awayTeam.abbreviation}
              </div>
              <div className="text-[10px] mt-0.5" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
                {game.awayTeam.displayName}
              </div>
            </div>
          </div>

          {/* Score or VS */}
          <div className="flex-shrink-0 text-center">
            {isLive ? (
              <div className="hero-score-lg chalk-score tabular-nums chalk-text-glow" style={{ color: 'var(--chalk-white)' }}>
                {game.awayTeam.score}
                <span className="hero-score-divider mx-3">-</span>
                {game.homeTeam.score}
              </div>
            ) : (
              <div className="hero-score-lg chalk-score" style={{ color: 'var(--chalk-ghost)', opacity: 0.5 }}>
                vs
              </div>
            )}
          </div>

          {/* Home */}
          <div className="flex-1 flex flex-col items-center gap-3">
            <TeamLogo logo={game.homeTeam.logo} name={game.homeTeam.displayName} size={72} glow={isLive} />
            <div className="text-center">
              <div className="text-base chalk-header" style={{ color: isLive && homeLeading ? 'var(--chalk-white)' : 'var(--chalk-dim)' }}>
                {game.homeTeam.abbreviation}
              </div>
              <div className="text-[10px] mt-0.5" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
                {game.homeTeam.displayName}
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
            className="hero-watch-btn-primary flex items-center gap-1.5 rounded-[4px] cursor-pointer"
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
          <span className="section-label-styled">{title}</span>
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

/* ─── Ticker Stat with count-up animation ─── */
function TickerStat({ label, value, highlight, format }: { label: string; value: number; highlight?: boolean; format?: boolean }) {
  const [displayed, setDisplayed] = useState(value);
  const prevValue = useRef(value);

  useEffect(() => {
    if (value === prevValue.current) return;
    const start = prevValue.current;
    prevValue.current = value;
    if (value === 0) { setDisplayed(0); return; }
    const duration = 600;
    const steps = 20;
    const increment = (value - start) / steps;
    let current = start;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      current += increment;
      if (step >= steps) {
        setDisplayed(value);
        clearInterval(timer);
      } else {
        setDisplayed(Math.round(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [value]);

  const isEmpty = value === 0;
  const display = isEmpty ? '--' : (format ? formatChalk(displayed) : displayed.toString());

  return (
    <div className="flex flex-col items-center gap-1 flex-1">
      <span
        className="text-2xl tabular-nums chalk-score"
        style={{
          color: isEmpty ? 'var(--chalk-ghost)' : highlight ? 'var(--color-yellow)' : 'var(--chalk-white)',
          opacity: isEmpty ? 0.5 : 1,
        }}
      >
        {display}
      </span>
      <span
        className="text-[8px] uppercase tracking-[0.2em]"
        style={{ color: highlight && !isEmpty ? 'rgba(245,217,96,0.5)' : 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-header)' }}
      >
        {label}
      </span>
    </div>
  );
}

function TickerDivider() {
  return (
    <div className="w-px h-9 chalk-ticker-divider" />
  );
}

function formatChalk(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return n.toString();
}
