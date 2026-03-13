'use client';

import { useEffect, useState, useCallback } from 'react';
import { Game, ROUND_LABELS, TournamentRound } from '@/lib/types';
import { GameOdds, KalshiMarket, buildKalshiTicker, buildSpreadEventTicker, matchOdds } from '@/lib/kalshi';
import { GameVolume } from '@/components/GameCard';
import { getFavorites } from '@/lib/favorites';
import Link from 'next/link';
import { TeamLogo } from '@/components/TeamLogo';
import { useSport, setSport } from '@/components/SportSelector';

export const dynamic = 'force-dynamic';

export default function GamesPage() {
  const sport = useSport();
  const [games, setGames] = useState<Game[]>([]);
  const [oddsMap, setOddsMap] = useState<Record<string, GameOdds>>({});
  const [volumeMap, setVolumeMap] = useState<Record<string, GameVolume>>({});
  const [roundMap, setRoundMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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

      if (loadedGames.length > 0) {
        const gameIds = loadedGames.map((g) => g.id).join(',');
        fetch(`/api/bets/volume?gameIds=${gameIds}`)
          .then((r) => r.json())
          .then((d) => setVolumeMap(d.volumes ?? {}))
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
    } catch { /* keep existing */ }
    finally { setLoading(false); }
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

  return (
    <div className="pinned-header-layout max-w-5xl mx-auto px-4">
      {/* Header */}
      <div className="pinned-header pt-4 pb-3">
        <div className="flex items-center justify-between mb-3 fade-up">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center gap-0.5 p-0.5 rounded-[5px]"
              style={{ background: 'var(--dust-light)', border: '1px dashed var(--dust-medium)' }}
            >
              <button
                onClick={() => setSport('nba')}
                className="px-3 py-1 rounded-[4px] text-xs font-bold tracking-wide transition-all duration-200 cursor-pointer"
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
                className="px-3 py-1 rounded-[4px] text-xs font-bold tracking-wide transition-all duration-200 cursor-pointer"
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
            <span className="text-[10px] tracking-wide" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {liveCount > 0 && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[10px] uppercase tracking-wider"
                style={{ background: 'rgba(245,217,96,0.08)', color: 'var(--color-yellow)', fontFamily: 'var(--font-chalk-header)', border: '1px dashed rgba(245,217,96,0.15)' }}
              >
                <span className="w-1.5 h-1.5 rounded-full live-ring" style={{ background: 'var(--color-yellow)' }} />
                {liveCount} Live
              </span>
            )}
            <button
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              className={`chalk-btn flex items-center gap-1 px-2 py-1 rounded-[4px] text-xs transition-all duration-200 cursor-pointer ${showFavoritesOnly ? 'chalk-btn-accent' : ''}`}
              style={{ fontFamily: 'var(--font-chalk-body)' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill={showFavoritesOnly ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={showFavoritesOnly ? 0 : 2}>
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              Favorites
            </button>
          </div>
        </div>

        {/* Search */}
        {!loading && games.length > 0 && (
          <div className="fade-up fade-up-delay-1">
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

      {/* Content */}
      <div className="pinned-scroll scrollbar-hide">
        {loading && (
          <div className="grid grid-cols-3 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="shimmer rounded-[6px] aspect-square" />
            ))}
          </div>
        )}

        {!loading && filteredGames.length === 0 && (
          <div className="text-center py-24 fade-up">
            <p className="text-base chalk-header" style={{ color: 'var(--chalk-dim)' }}>
              {showFavoritesOnly ? 'No favorite teams playing' : 'No games today'}
            </p>
            <p className="text-sm mt-2" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
              {showFavoritesOnly ? 'None of your favorites have games today' : 'Check back later'}
            </p>
          </div>
        )}

        {!loading && (
          <div className="space-y-8">
            {sport === 'ncaam' && Object.keys(roundMap).length > 0 ? (
              (() => {
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
                        <GameGridSection
                          key={round}
                          title={ROUND_LABELS[round as TournamentRound] ?? round}
                          games={rGames}
                          oddsMap={oddsMap}
                          volumeMap={volumeMap}
                        />
                      );
                    })}
                    {nonTournament.length > 0 && (
                      <GameGridSection title="Other Games" games={nonTournament} oddsMap={oddsMap} volumeMap={volumeMap} />
                    )}
                  </>
                );
              })()
            ) : (
              <>
                {liveGames.length > 0 && (
                  <GameGridSection
                    title="Live"
                    games={liveGames}
                    oddsMap={oddsMap}
                    volumeMap={volumeMap}
                    accent="var(--color-yellow)"
                    icon={<span className="w-1.5 h-1.5 rounded-full live-ring" style={{ background: 'var(--color-yellow)' }} />}
                  />
                )}
                {upcomingGames.length > 0 && (
                  <GameGridSection
                    title="Upcoming"
                    games={upcomingGames}
                    oddsMap={oddsMap}
                    volumeMap={volumeMap}
                  />
                )}
                {finalGames.length > 0 && (
                  <GameGridSection
                    title="Final"
                    games={finalGames}
                    oddsMap={oddsMap}
                    volumeMap={volumeMap}
                  />
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function GameGridSection({ title, games, oddsMap, volumeMap, accent, icon }: {
  title: string;
  games: Game[];
  oddsMap: Record<string, GameOdds>;
  volumeMap: Record<string, GameVolume>;
  accent?: string;
  icon?: React.ReactNode;
}) {
  return (
    <section className="fade-up">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex items-center gap-2">
          {icon}
          <span className="section-label-styled">{title}</span>
          <span className="text-[10px] tabular-nums chalk-header" style={{ color: accent || 'var(--chalk-ghost)', opacity: 0.6 }}>
            {games.length}
          </span>
        </div>
        <div className="flex-1 chalk-ruled-line" style={{ opacity: 0.3 }} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {games.map((game, i) => (
          <div key={game.id} className={`fade-up fade-up-delay-${Math.min(i + 1, 3)}`}>
            <SquareGameCard game={game} odds={oddsMap[game.id]} volume={volumeMap[game.id]} />
          </div>
        ))}
      </div>
    </section>
  );
}

function formatChalk(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return n.toString();
}

function SquareGameCard({ game, odds, volume }: { game: Game; odds?: GameOdds; volume?: GameVolume }) {
  const isLive = game.state === 'in';
  const isFinal = game.state === 'post';
  const homeLeading = Number(game.homeTeam.score) > Number(game.awayTeam.score);
  const awayLeading = Number(game.awayTeam.score) > Number(game.homeTeam.score);

  const tipoff = new Date(game.date).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <Link href={`/game/${game.id}`} className="block group">
      <div
        className={`chalk-card rounded-[6px] p-2.5 cursor-pointer transition-all duration-200 hover:translate-y-[-2px] ${
          isLive ? 'live-card-pulse' : ''
        } ${isFinal ? 'opacity-60 hover:opacity-100' : ''}`}
        style={{ border: isLive ? '1px dashed rgba(245,217,96,0.25)' : undefined }}
      >
        {/* Status row */}
        <div className="flex items-center justify-between mb-2">
          {isLive ? (
            <span className="flex items-center gap-1">
              <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: 'var(--color-yellow)' }} />
              <span className="text-[8px] uppercase tracking-wider chalk-header" style={{ color: 'var(--color-yellow)' }}>
                {game.shortDetail}
              </span>
            </span>
          ) : isFinal ? (
            <span className="text-[8px] uppercase tracking-wider chalk-header" style={{ color: 'var(--chalk-ghost)' }}>Final</span>
          ) : (
            <span className="text-[8px]" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>{tipoff}</span>
          )}
          {volume && volume.total > 0 && (
            <span className="text-[8px] tabular-nums chalk-header" style={{ color: 'var(--color-yellow)' }}>
              {formatChalk(volume.total)}
            </span>
          )}
        </div>

        {/* Teams */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <TeamLogo logo={game.awayTeam.logo} name={game.awayTeam.displayName} size={22} />
            <span className="text-[11px] chalk-header flex-1 truncate" style={{ color: isLive && awayLeading ? 'var(--chalk-white)' : 'var(--chalk-dim)' }}>
              {game.awayTeam.abbreviation}
            </span>
            {(isLive || isFinal) && (
              <span className="text-xs tabular-nums chalk-score" style={{ color: awayLeading ? 'var(--chalk-white)' : 'var(--chalk-dim)' }}>
                {game.awayTeam.score}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <TeamLogo logo={game.homeTeam.logo} name={game.homeTeam.displayName} size={22} />
            <span className="text-[11px] chalk-header flex-1 truncate" style={{ color: isLive && homeLeading ? 'var(--chalk-white)' : 'var(--chalk-dim)' }}>
              {game.homeTeam.abbreviation}
            </span>
            {(isLive || isFinal) && (
              <span className="text-xs tabular-nums chalk-score" style={{ color: homeLeading ? 'var(--chalk-white)' : 'var(--chalk-dim)' }}>
                {game.homeTeam.score}
              </span>
            )}
          </div>
        </div>

        {/* Broadcast */}
        {game.broadcast && (
          <div className="mt-2 pt-1.5" style={{ borderTop: '1px dashed rgba(232,228,217,0.06)' }}>
            <span className="text-[8px]" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
              {game.broadcast}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
