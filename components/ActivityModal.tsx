'use client';

import { useUser } from '@/hooks/useUser';
import { useChalkPrice, formatUsd } from '@/hooks/useChalkPrice';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { type Bet, BetDetailModal, toAmericanOdds } from '@/components/betting/BetCard';

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

export function ActivityModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { authenticated, userId, getAccessToken, login, ready } = useUser();
  const { price } = useChalkPrice();
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBet, setSelectedBet] = useState<Bet | null>(null);
  const [filter, setFilter] = useState<'all' | 'open' | 'live' | 'graded'>('all');

  useEffect(() => {
    if (!open || !authenticated) { setLoading(false); return; }
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
  }, [open, authenticated, getAccessToken]);

  if (!open) return null;

  const outcomes = bets.map((b) => getOutcome(b, userId!));
  const wins = outcomes.filter((o) => o === 'won').length;
  const losses = outcomes.filter((o) => o === 'lost').length;
  const pushes = outcomes.filter((o) => o === 'push').length;
  const settled = wins + losses + pushes;
  const winRate = settled > 0 ? Math.round((wins / settled) * 100) : 0;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex justify-end"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} onClick={onClose} />

      {/* Slide-in panel */}
      <div
        className="relative w-full max-w-md h-full flex flex-col animate-slide-in-right"
        style={{
          background: 'var(--board-dark)',
          borderLeft: '1px dashed rgba(232,228,217,0.12)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3" style={{ borderBottom: '1px dashed rgba(232,228,217,0.08)' }}>
          <h2 className="text-lg chalk-header" style={{ color: 'var(--chalk-white)' }}>Activity</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-[4px] cursor-pointer transition-all duration-150 hover:scale-105"
            style={{ color: 'var(--chalk-ghost)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-4">
          {!ready ? null : !authenticated ? (
            <div className="text-center pt-10">
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
          ) : loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-[4px] shimmer" />
              ))}
            </div>
          ) : (
            <>
              {/* Stats bar */}
              <div className="flex flex-wrap gap-2 mb-3">
                <StatPill label="Total" value={bets.length} color="var(--chalk-white)" />
                <StatPill label="W" value={wins} color="var(--color-green)" />
                <StatPill label="L" value={losses} color="var(--color-red)" />
                <StatPill label="P" value={pushes} color="var(--chalk-dim)" />
                <StatPill label="Win %" value={`${winRate}%`} color="var(--color-yellow)" />
              </div>

              {/* Filter tabs */}
              <div className="flex gap-1 mb-4">
                {(['all', 'open', 'live', 'graded'] as const).map((tab) => {
                  const active = filter === tab;
                  const count = tab === 'all' ? bets.length
                    : tab === 'open' ? outcomes.filter((o) => o === 'open').length
                    : tab === 'live' ? outcomes.filter((o) => o === 'live').length
                    : outcomes.filter((o) => o === 'won' || o === 'lost' || o === 'push').length;
                  return (
                    <button
                      key={tab}
                      onClick={() => setFilter(tab)}
                      className="px-3 py-1.5 rounded-[4px] text-[11px] chalk-header tracking-wide cursor-pointer transition-all duration-150"
                      style={{
                        color: active ? 'var(--chalk-white)' : 'var(--chalk-ghost)',
                        background: active ? 'rgba(245,217,96,0.10)' : 'transparent',
                        border: active ? '1px dashed rgba(245,217,96,0.25)' : '1px dashed rgba(232,228,217,0.08)',
                      }}
                    >
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                      <span className="ml-1.5 text-[9px] opacity-60">{count}</span>
                    </button>
                  );
                })}
              </div>

              {bets.length === 0 ? (
                <p className="text-sm text-center py-10" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
                  No bets yet. Head to a game to create your first prop.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {bets.map((bet, i) => {
                    const outcome = outcomes[i];
                    if (filter === 'open' && outcome !== 'open') return null;
                    if (filter === 'live' && outcome !== 'live') return null;
                    if (filter === 'graded' && outcome !== 'won' && outcome !== 'lost' && outcome !== 'push') return null;
                    const style = OUTCOME_STYLES[outcome];
                    const isCreator = bet.creatorId === userId;
                    const statLabel = STAT_LABELS[bet.stat] || bet.stat;
                    const userDir = isCreator ? bet.direction : (bet.direction === 'over' ? 'under' : 'over');
                    const dirColor = userDir === 'over' ? 'var(--color-green)' : 'var(--color-red)';
                    const stake = isCreator ? bet.creatorStake : bet.takerStake;
                    const totalPot = bet.creatorStake + bet.takerStake;
                    const opponent = isCreator ? bet.takerName : bet.creatorName;

                    return (
                      <div
                        key={bet.id}
                        className="chalk-card rounded-[4px] overflow-hidden cursor-pointer"
                        style={{ borderLeft: `2px solid ${style.color}` }}
                        onClick={() => setSelectedBet(bet)}
                      >
                        {/* Top section */}
                        <div className="px-3.5 pt-3 pb-2">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span
                                className="text-[8px] chalk-header tracking-[0.15em] px-1.5 py-0.5 rounded-[2px]"
                                style={{ background: `${style.color}12`, color: style.color, border: `1px dashed ${style.color}30` }}
                              >
                                {style.label}
                              </span>
                              <span className="text-[10px]" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
                                {relativeTime(bet.createdAt)}
                              </span>
                            </div>
                            {outcome === 'won' && (
                              <span className="text-[10px] chalk-header" style={{ color: 'var(--color-green)' }}>
                                +{totalPot - stake}
                              </span>
                            )}
                            {outcome === 'lost' && (
                              <span className="text-[10px] chalk-header" style={{ color: 'var(--color-red)' }}>
                                -{stake}
                              </span>
                            )}
                          </div>

                          {/* Player + prop line */}
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm chalk-header truncate" style={{ color: 'var(--chalk-white)' }}>
                              {bet.player}
                            </span>
                            <span
                              className="px-1.5 py-px rounded-[3px] text-[10px] chalk-header tracking-wide flex-shrink-0"
                              style={{ background: `${dirColor}15`, color: dirColor, border: `1px dashed ${dirColor}30` }}
                            >
                              {userDir.toUpperCase()}
                            </span>
                            <span className="text-base tabular-nums chalk-score flex-shrink-0" style={{ color: 'var(--chalk-white)' }}>
                              {bet.target}
                            </span>
                            <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
                              {statLabel}
                            </span>
                          </div>

                          {bet.gameTitle && (
                            <div className="text-[9px] truncate" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
                              {bet.gameTitle}
                            </div>
                          )}
                        </div>

                        {/* Bottom stats bar */}
                        <div
                          className="px-3.5 py-2 flex items-center justify-between"
                          style={{ background: 'rgba(232,228,217,0.02)', borderTop: '1px dashed rgba(232,228,217,0.06)' }}
                        >
                          <div className="flex items-center gap-4">
                            <div>
                              <div className="text-[8px] uppercase tracking-wider" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>Stake</div>
                              <div className="text-sm tabular-nums chalk-score" style={{ color: 'var(--color-yellow)' }}>
                                {stake.toLocaleString()}
                                {price !== null && (
                                  <span className="text-[9px] ml-1 opacity-50" style={{ color: 'var(--chalk-dim)', fontFamily: 'var(--font-chalk-body)' }}>
                                    {formatUsd(stake, price)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div>
                              <div className="text-[8px] uppercase tracking-wider" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>Pot</div>
                              <div className="text-sm tabular-nums chalk-score" style={{ color: 'var(--color-green)' }}>
                                {totalPot.toLocaleString()}
                                {price !== null && (
                                  <span className="text-[9px] ml-1 opacity-50" style={{ color: 'var(--chalk-dim)', fontFamily: 'var(--font-chalk-body)' }}>
                                    {formatUsd(totalPot, price)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-[8px] uppercase tracking-wider" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
                              {opponent ? 'vs' : isCreator ? 'Waiting' : ''}
                            </div>
                            <div className="text-[11px] chalk-header truncate max-w-[100px]" style={{ color: opponent ? 'var(--chalk-dim)' : 'var(--chalk-ghost)' }}>
                              {opponent || (isCreator ? 'Open' : '')}
                            </div>
                          </div>
                        </div>

                        {/* Settled result bar */}
                        {bet.status === 'settled' && bet.actualValue != null && (
                          <div
                            className="px-3.5 py-1.5 flex items-center gap-2 text-[10px]"
                            style={{ background: 'rgba(232,228,217,0.03)', borderTop: '1px dashed rgba(232,228,217,0.06)', fontFamily: 'var(--font-chalk-body)' }}
                          >
                            <span style={{ color: 'var(--chalk-ghost)' }}>Actual:</span>
                            <span className="tabular-nums chalk-header" style={{ color: 'var(--chalk-white)' }}>{bet.actualValue} {statLabel}</span>
                            <span style={{ color: 'var(--chalk-ghost)' }}>&rarr;</span>
                            <span style={{ color: outcome === 'won' ? 'var(--color-green)' : outcome === 'lost' ? 'var(--color-red)' : 'var(--chalk-dim)' }}>
                              {outcome === 'won' ? 'You won' : outcome === 'lost' ? 'You lost' : 'Push'}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Bet Detail Modal (nested) */}
      {selectedBet && (
        <BetDetailModal
          bet={selectedBet}
          statLabel={STAT_LABELS[selectedBet.stat] || selectedBet.stat}
          takerOdds={toAmericanOdds(selectedBet.creatorStake / selectedBet.takerStake)}
          creatorOdds={toAmericanOdds(selectedBet.takerStake / selectedBet.creatorStake)}
          pool={selectedBet.creatorStake + selectedBet.takerStake}
          isCreator={selectedBet.creatorId === userId}
          isOpen={selectedBet.status === 'open'}
          loading={false}
          onCancel={() => {}}
          onClose={() => setSelectedBet(null)}
          price={price}
        />
      )}
    </div>,
    document.body
  );
}

function StatPill({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div
      className="px-2.5 py-1 rounded-[4px] flex items-center gap-1.5"
      style={{ background: `${color}08`, border: `1px dashed ${color}20` }}
    >
      <span className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
        {label}
      </span>
      <span className="text-sm tabular-nums chalk-score" style={{ color }}>{value}</span>
    </div>
  );
}
