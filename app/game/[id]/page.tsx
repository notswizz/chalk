'use client';

import { useEffect, useState, useRef, useCallback, use } from 'react';
import Link from 'next/link';
import { Game, StreamLink } from '@/lib/types';
import { GameOdds, KalshiMarket, buildKalshiTicker, buildSpreadEventTicker, matchOdds, ESPN_TO_KALSHI } from '@/lib/kalshi';
import { ScoreDisplay } from '@/components/ScoreDisplay';
import { StreamPlayer } from '@/components/StreamPlayer';
import { StreamSourceButton } from '@/components/StreamSourceButton';
import { FavoriteButton } from '@/components/FavoriteButton';
import { GameChat } from '@/components/GameChat';
import { BetFeed } from '@/components/betting/BetFeed';
import { GameVolume } from '@/components/GameCard';
import { GameClips } from '@/components/GameClips';
import { useUser } from '@/hooks/useUser';

export const dynamic = 'force-dynamic';

export default function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { authenticated, userId, getAccessToken, login } = useUser();
  const [game, setGame] = useState<Game | null>(null);
  const [streams, setStreams] = useState<StreamLink[]>([]);
  const [activeStream, setActiveStream] = useState<number>(0);
  const [odds, setOdds] = useState<GameOdds | null>(null);
  const [kalshiTicker, setKalshiTicker] = useState('');
  const [volume, setVolume] = useState<GameVolume | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [votes, setVotes] = useState<Record<string, { upvotes: number; downvotes: number; score: number }>>({});
  const [userVotes, setUserVotes] = useState<Record<string, 'up' | 'down'>>({});

  // Fetch game data, volume, and odds in parallel (fast) — streams load separately
  useEffect(() => {
    async function load() {
      try {
        const [gamesRes, volumeRes, oddsRes] = await Promise.all([
          fetch(`/api/scores?ids=${id}`),
          fetch(`/api/bets/volume?gameIds=${id}`),
          fetch('/api/odds'),
        ]);

        const gamesData = await gamesRes.json();
        const gameData = gamesData.games?.[0] ?? null;
        setGame(gameData);

        const volumeData = await volumeRes.json();
        setVolume(volumeData.volumes?.[id] ?? null);

        const oddsData = await oddsRes.json();
        if (gameData) {
          const markets: KalshiMarket[] = oddsData.markets ?? [];
          const spreads: KalshiMarket[] = oddsData.spreads ?? [];
          if (markets.length > 0) {
            const d = new Date(gameData.date);
            const ticker = buildKalshiTicker(d, gameData.awayTeam.abbreviation, gameData.homeTeam.abbreviation);
            const spreadTicker = buildSpreadEventTicker(d, gameData.awayTeam.abbreviation, gameData.homeTeam.abbreviation);
            setKalshiTicker(ticker);
            setOdds(matchOdds(markets, ticker, gameData.awayTeam.abbreviation, gameData.homeTeam.abbreviation, spreads, spreadTicker));
          }
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  // Fetch streams separately (slow — scrapes external sites)
  useEffect(() => {
    fetch(`/api/streams/${id}`)
      .then((r) => r.json())
      .then((d) => setStreams(d.streams ?? []))
      .catch(() => {});
  }, [id]);

  // Polling: volume + odds refresh every 30s
  useEffect(() => {
    if (!game) return;
    async function refresh() {
      try {
        const [volumeRes, oddsRes] = await Promise.all([
          fetch(`/api/bets/volume?gameIds=${id}`),
          fetch('/api/odds'),
        ]);
        const volumeData = await volumeRes.json();
        setVolume(volumeData.volumes?.[id] ?? null);

        const oddsData = await oddsRes.json();
        const markets: KalshiMarket[] = oddsData.markets ?? [];
        const spreads: KalshiMarket[] = oddsData.spreads ?? [];
        if (markets.length > 0 && game) {
          const d = new Date(game.date);
          const ticker = buildKalshiTicker(d, game.awayTeam.abbreviation, game.homeTeam.abbreviation);
          const spreadTicker = buildSpreadEventTicker(d, game.awayTeam.abbreviation, game.homeTeam.abbreviation);
          setKalshiTicker(ticker);
          setOdds(matchOdds(markets, ticker, game.awayTeam.abbreviation, game.homeTeam.abbreviation, spreads, spreadTicker));
        }
      } catch { /* silent */ }
    }
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [game, id]);

  useEffect(() => {
    if (!game || game.state !== 'in') return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/scores?ids=${id}`);
        const data = await res.json();
        if (data.games?.[0]) setGame(data.games[0]);
      } catch { /* silent */ }
    }, 30000);
    return () => clearInterval(interval);
  }, [game, id]);

  // Auto-settle bets 30 min after game ends
  const autoSettleFired = useRef(false);
  useEffect(() => {
    if (!game || game.state !== 'post' || autoSettleFired.current) return;
    autoSettleFired.current = true;
    fetch('/api/bets/auto-settle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId: id, gameEndedAt: game.date }),
    }).catch(() => {});
  }, [game, id]);

  // Fetch votes
  useEffect(() => {
    if (streams.length === 0) return;
    async function fetchVotes() {
      try {
        const params = new URLSearchParams({ gameId: id });
        if (userId) params.set('userId', userId);
        const res = await fetch(`/api/streams/vote?${params}`);
        const data = await res.json();
        setVotes(data.votes || {});
        setUserVotes(data.userVotes || {});
      } catch { /* silent */ }
    }
    fetchVotes();
  }, [id, userId, streams.length]);

  const handleVote = useCallback(async (streamId: string, sourceName: string, vote: 'up' | 'down') => {
    if (!authenticated) {
      login();
      return;
    }

    // Optimistic update
    setVotes((prev) => {
      const current = prev[streamId] || { upvotes: 0, downvotes: 0, score: 0 };
      const existingVote = userVotes[streamId];
      let { upvotes, downvotes } = current;

      // Remove old vote
      if (existingVote === 'up') upvotes--;
      if (existingVote === 'down') downvotes--;

      // Toggle: same vote = remove, otherwise apply
      const newVote = existingVote === vote ? null : vote;
      if (newVote === 'up') upvotes++;
      if (newVote === 'down') downvotes++;

      return { ...prev, [streamId]: { upvotes, downvotes, score: upvotes - downvotes } };
    });

    setUserVotes((prev) => {
      const existing = prev[streamId];
      if (existing === vote) {
        const next = { ...prev };
        delete next[streamId];
        return next;
      }
      return { ...prev, [streamId]: vote };
    });

    try {
      const token = await getAccessToken();
      await fetch('/api/streams/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ streamId, gameId: id, sourceName, vote }),
      });
    } catch { /* silent — optimistic UI already updated */ }
  }, [authenticated, login, getAccessToken, id, userVotes]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 pt-6">
        <div className="shimmer rounded-[4px] aspect-video mb-4" />
        <div className="shimmer rounded-[4px] h-24 mb-4" />
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="max-w-6xl mx-auto px-4 pt-20 text-center fade-up">
        <div className="w-16 h-16 mx-auto mb-4 rounded-[4px] flex items-center justify-center text-3xl"
          style={{ background: 'var(--dust-light)' }}
        >
          😔
        </div>
        <p className="text-sm font-semibold" style={{ color: 'var(--chalk-dim)' }}>Game not found</p>
        <Link href="/" className="text-xs mt-2 inline-block transition-colors" style={{ color: 'var(--color-yellow)' }}>
          Back to games
        </Link>
      </div>
    );
  }

  const currentStream = streams[activeStream];

  return (
    <div className="max-w-7xl mx-auto px-4 pt-4 pb-6 fade-up">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-4">
        <Link
          href="/"
          className="flex items-center gap-2 transition-colors"
          style={{ color: 'var(--chalk-ghost)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <span className="text-xs font-semibold">Back</span>
        </Link>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--chalk-ghost)' }}>{game.awayTeam.abbreviation}</span>
            <FavoriteButton
              team={{ abbreviation: game.awayTeam.abbreviation, displayName: game.awayTeam.displayName, sport: game.sport }}
            />
          </div>
          <div className="w-px h-4" style={{ background: 'var(--dust-light)' }} />
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--chalk-ghost)' }}>{game.homeTeam.abbreviation}</span>
            <FavoriteButton
              team={{ abbreviation: game.homeTeam.abbreviation, displayName: game.homeTeam.displayName, sport: game.sport }}
            />
          </div>
        </div>
      </div>

      {/* Main layout: 3-column on desktop (Chat | Player | Board), stacked on mobile */}
      <div className="flex flex-col lg:flex-row lg:items-start gap-3">
        {/* Left: Chat — skinny */}
        <div className="hidden lg:flex lg:flex-col lg:w-[220px] lg:flex-shrink-0">
          <GameChat gameId={id} />
        </div>

        {/* Center: Scoreboard + Player + Sources — takes most space */}
        <div className="flex-1 min-w-0">
          {/* Score card — compact, above player */}
          <div className="mb-3 p-4 rounded-[4px] chalk-card">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <ScoreDisplay game={game} large />
              </div>
              {volume && volume.total > 0 && (
                <div
                  className="flex-shrink-0 ml-3 px-2.5 py-1.5 rounded-[4px] text-center"
                  style={{ background: 'rgba(245,217,96,0.08)', border: '1px dashed rgba(245,217,96,0.12)' }}
                >
                  <div className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: 'var(--chalk-ghost)' }}>Volume</div>
                  <div className="text-sm font-extrabold tabular-nums" style={{ color: 'var(--color-yellow)' }}>
                    {volume.total >= 1000 ? `${(volume.total / 1000).toFixed(volume.total >= 10000 ? 0 : 1)}k` : volume.total}
                  </div>
                  {volume.pending > 0 && (
                    <div className="text-[9px] mt-0.5" style={{ color: 'var(--chalk-ghost)' }}>
                      {volume.pending >= 1000 ? `${(volume.pending / 1000).toFixed(1)}k` : volume.pending} pending
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Odds row */}
            {odds && odds.away !== null && odds.home !== null && game.state !== 'post' && (() => {
              const awayKalshi = ESPN_TO_KALSHI[game.awayTeam.abbreviation] || game.awayTeam.abbreviation;
              const homeKalshi = ESPN_TO_KALSHI[game.homeTeam.abbreviation] || game.homeTeam.abbreviation;
              const favKalshi = odds.away! >= odds.home! ? awayKalshi : homeKalshi;
              const marketUrl = kalshiTicker
                ? `https://kalshi.com/markets/kxnbagame/${kalshiTicker.toLowerCase()}-${favKalshi.toLowerCase()}`
                : 'https://kalshi.com';
              return (
                <a
                  href={marketUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 pt-3 flex items-center justify-between gap-3 group"
                  style={{ borderTop: '1px dashed var(--dust-light)' }}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--chalk-ghost)' }}>{game.awayTeam.abbreviation}</span>
                    <span className="text-sm font-extrabold tabular-nums" style={{ color: odds.away! >= odds.home! ? 'var(--color-green)' : 'var(--chalk-ghost)' }}>
                      {odds.away}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1 rounded-[4px] transition-colors">
                    <img src="https://kalshi.com/favicon.ico" alt="Kalshi" width={12} height={12} className="rounded-sm opacity-50 group-hover:opacity-80 transition-opacity" />
                    {odds.spread ? (
                      <span className="text-[11px] font-bold tabular-nums" style={{ color: 'var(--color-blue)' }}>{odds.spread.team} -{odds.spread.line}</span>
                    ) : (
                      <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--chalk-ghost)' }}>Odds</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-extrabold tabular-nums" style={{ color: odds.home! >= odds.away! ? 'var(--color-green)' : 'var(--chalk-ghost)' }}>
                      {odds.home}%
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--chalk-ghost)' }}>{game.homeTeam.abbreviation}</span>
                  </div>
                </a>
              );
            })()}
          </div>

          {/* Video player */}
          {currentStream ? (
            <div className="rounded-[6px] overflow-hidden shadow-2xl shadow-black/50" style={{ border: '1.5px dashed rgba(232,228,217,0.15)' }}>
              <StreamPlayer stream={currentStream} gameId={id} gameTitle={`${game.awayTeam.displayName} vs ${game.homeTeam.displayName}`} sport={game.sport} />
            </div>
          ) : (
            <div
              className="aspect-video w-full rounded-[4px] flex items-center justify-center"
              style={{ background: 'var(--board-light)', border: '1px dashed var(--dust-light)' }}
            >
              <div className="text-center px-6">
                <div className="w-14 h-14 mx-auto mb-3 rounded-[4px] flex items-center justify-center text-2xl"
                  style={{ background: 'var(--dust-light)' }}
                >
                  📺
                </div>
                <p className="text-sm font-semibold" style={{ color: 'var(--chalk-dim)' }}>No streams available</p>
                <p className="text-[11px] mt-1" style={{ color: 'var(--chalk-ghost)' }}>Check back closer to game time</p>
              </div>
            </div>
          )}

          {/* Sources + Clips side by side */}
          <div className="mt-3 flex flex-col sm:flex-row sm:items-start gap-3">
            {streams.length > 0 && (
              <div className="sm:flex-shrink-0">
                <div className="section-label mb-2.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--chalk-ghost)' }}>
                    <path d="M2 16.1A5 5 0 0 1 5.9 20M2 12.05A9 9 0 0 1 9.95 20M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6" />
                    <circle cx="4" cy="20" r="2" fill="currentColor" />
                  </svg>
                  Sources
                </div>
                <div className="flex flex-wrap gap-2">
                  {streams.map((stream, i) => (
                    <StreamSourceButton
                      key={stream.id || i}
                      stream={stream}
                      active={i === activeStream}
                      index={i}
                      onClick={() => setActiveStream(i)}
                      voteScore={stream.id ? votes[stream.id]?.score : undefined}
                      userVote={stream.id ? userVotes[stream.id] ?? null : null}
                      onVote={stream.id ? (vote) => handleVote(stream.id!, stream.sourceName || '', vote) : undefined}
                    />
                  ))}
                </div>
              </div>
            )}

            <GameClips gameId={id} />
          </div>

        </div>

        {/* Right: Bet Feed — slim */}
        <div className="lg:w-[260px] lg:flex-shrink-0">
          {/* Mobile chat (hidden on desktop since it's in left column) */}
          <div className="lg:hidden">
            <GameChat gameId={id} />
          </div>
          <BetFeed
            gameId={id}
            gameTitle={`${game.awayTeam.displayName} vs ${game.homeTeam.displayName}`}
            gameOver={game.state === 'post'}
            gameLive={game.state === 'in'}
            teams={[game.awayTeam.abbreviation, game.homeTeam.abbreviation]}
            teamIds={[game.awayTeam.id || '', game.homeTeam.id || '']}
            teamLogos={[game.awayTeam.logo, game.homeTeam.logo]}
            sport={game.sport}
          />
        </div>
      </div>
    </div>
  );
}
