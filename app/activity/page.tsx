'use client';

import { useUser } from '@/hooks/useUser';
import { useChalkPrice, formatUsd } from '@/hooks/useChalkPrice';
import { useState, useEffect } from 'react';
import type { Bet } from '@/components/betting/BetCard';

type Outcome = 'won' | 'lost' | 'push' | 'live' | 'open' | 'cancelled';

const STAT_LABELS: Record<string, string> = { points: 'PTS', rebounds: 'REB', assists: 'AST', threes: '3PM' };

function getOutcome(bet: Bet, userId: string): Outcome {
  if (bet.status === 'cancelled') return 'cancelled';
  if (bet.status === 'open') return 'open';
  if (bet.status === 'matched' && !bet.result) return 'live';
  if (bet.result === 'push') return 'push';

  const isCreator = bet.creatorId === userId;
  if (bet.result === 'creator_wins') return isCreator ? 'won' : 'lost';
  if (bet.result === 'taker_wins') return isCreator ? 'lost' : 'won';

  return 'live';
}

const OUTCOME_STYLES: Record<Outcome, { color: string; label: string }> = {
  won: { color: 'var(--color-green)', label: 'WON' },
  lost: { color: 'var(--color-red)', label: 'LOST' },
  push: { color: 'var(--chalk-dim)', label: 'PUSH' },
  live: { color: 'var(--color-yellow)', label: 'LIVE' },
  open: { color: 'var(--chalk-white)', label: 'OPEN' },
  cancelled: { color: 'var(--chalk-ghost)', label: 'ERASED' },
};

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function ActivityPage() {
  const { authenticated, userId, getAccessToken, login, ready } = useUser();
  const { price } = useChalkPrice();
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authenticated) { setLoading(false); return; }
    let cancelled = false;

    async function fetchBets() {
      try {
        const token = await getAccessToken();
        const res = await fetch('/api/bets/mine', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok && !cancelled) {
          const data = await res.json();
          setBets(data.bets ?? []);
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchBets();
    return () => { cancelled = true; };
  }, [authenticated, getAccessToken]);

  if (!ready) return null;

  if (!authenticated) {
    return (
      <div className="max-w-2xl mx-auto px-4 pt-20 text-center">
        <h1 className="text-2xl chalk-header mb-4" style={{ color: 'var(--chalk-white)' }}>Activity</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
          Sign in to see your betting history.
        </p>
        <button
          onClick={() => login()}
          className="chalk-btn chalk-btn-accent px-5 py-2.5 rounded-[4px] text-sm chalk-header cursor-pointer"
        >
          Sign In
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 pt-10">
        <h1 className="text-xl chalk-header mb-6" style={{ color: 'var(--chalk-white)' }}>Activity</h1>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-[4px] shimmer" />
          ))}
        </div>
      </div>
    );
  }

  // Compute stats
  const outcomes = bets.map((b) => getOutcome(b, userId!));
  const wins = outcomes.filter((o) => o === 'won').length;
  const losses = outcomes.filter((o) => o === 'lost').length;
  const pushes = outcomes.filter((o) => o === 'push').length;
  const settled = wins + losses + pushes;
  const winRate = settled > 0 ? Math.round((wins / settled) * 100) : 0;

  return (
    <div className="pinned-header-layout max-w-2xl mx-auto px-4">
      {/* ─── Pinned Header ─── */}
      <div className="pinned-header pt-6 pb-4">
        <h1 className="text-xl chalk-header mb-5" style={{ color: 'var(--chalk-white)' }}>Activity</h1>

        {/* Stats bar */}
        <div className="flex flex-wrap gap-2">
          <StatPill label="Total" value={bets.length} color="var(--chalk-white)" />
          <StatPill label="Wins" value={wins} color="var(--color-green)" />
          <StatPill label="Losses" value={losses} color="var(--color-red)" />
          <StatPill label="Pushes" value={pushes} color="var(--chalk-dim)" />
          <StatPill label="Win %" value={`${winRate}%`} color="var(--color-yellow)" />
        </div>
      </div>

      {/* ─── Scrollable Timeline ─── */}
      <div className="pinned-scroll scrollbar-hide">
        {bets.length === 0 ? (
          <p className="text-sm text-center py-10" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
            No bets yet. Head to a game to create your first prop.
          </p>
        ) : (
          <div className="space-y-2">
            {bets.map((bet, i) => {
              const outcome = outcomes[i];
              const style = OUTCOME_STYLES[outcome];
              const isCreator = bet.creatorId === userId;
              const statLabel = STAT_LABELS[bet.stat] || bet.stat;
              const dirColor = bet.direction === 'over' ? 'var(--color-green)' : 'var(--color-red)';
              const stake = isCreator ? bet.creatorStake : bet.takerStake;

              return (
                <div
                  key={bet.id}
                  className="chalk-card rounded-[4px] px-3 py-2.5 fade-up"
                  style={{ animationDelay: `${Math.min(i * 30, 300)}ms`, opacity: 0 }}
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* Left: outcome dot + bet info */}
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <div
                        className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                        style={{ background: style.color, boxShadow: `0 0 6px ${style.color}40` }}
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px]" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
                            {isCreator ? 'Created' : 'Took'}
                          </span>
                          <span className="text-sm chalk-header truncate" style={{ color: 'var(--chalk-white)' }}>
                            {bet.player}
                          </span>
                          <span
                            className="px-1 py-px rounded-[2px] text-[9px] chalk-header tracking-wide"
                            style={{ background: `${dirColor}15`, color: dirColor, border: `1px dashed ${dirColor}30` }}
                          >
                            {bet.direction.toUpperCase()}
                          </span>
                          <span className="text-sm tabular-nums chalk-score" style={{ color: 'var(--chalk-white)' }}>
                            {bet.target}
                          </span>
                          <span className="text-[10px]" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
                            {statLabel}
                          </span>
                        </div>

                        {bet.gameTitle && (
                          <div className="text-[9px] truncate mt-0.5" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
                            {bet.gameTitle}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: outcome + stake + time */}
                    <div className="flex-shrink-0 text-right flex flex-col items-end gap-0.5">
                      <span className="text-[9px] chalk-header tracking-[0.12em]" style={{ color: style.color }}>
                        {style.label}
                      </span>
                      <span className="text-sm tabular-nums chalk-score" style={{ color: 'var(--color-yellow)' }}>
                        {stake}
                      </span>
                      {price !== null && (
                        <span className="text-[9px] tabular-nums opacity-50" style={{ color: 'var(--chalk-dim)' }}>
                          {formatUsd(stake, price)}
                        </span>
                      )}
                      <span className="text-[9px] tabular-nums" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
                        {relativeTime(bet.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatPill({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div
      className="px-3 py-1.5 rounded-[4px] flex items-center gap-2"
      style={{ background: `${color}08`, border: `1px dashed ${color}20` }}
    >
      <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
        {label}
      </span>
      <span className="text-base tabular-nums chalk-score" style={{ color }}>{value}</span>
    </div>
  );
}
