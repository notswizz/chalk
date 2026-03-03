'use client';

import { useUser } from '@/hooks/useUser';
import { useChalkPrice, formatUsd } from '@/hooks/useChalkPrice';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ChalkCardModal } from '@/components/chalk-cards/ChalkCardModal';

export interface Bet {
  id: string;
  creatorId: string;
  creatorName: string;
  takerId: string | null;
  takerName: string | null;
  gameId: string;
  gameTitle?: string;
  player: string;
  stat: string;
  target: number;
  direction: string;
  creatorStake: number;
  takerStake: number;
  odds: number;
  status: string;
  result?: string;
  actualValue?: number;
  createdAt: number;
}

const STAT_LABELS: Record<string, string> = { points: 'PTS', rebounds: 'REB', assists: 'AST', threes: '3PM' };

export function toAmericanOdds(decimal: number) {
  if (decimal >= 1) return `+${Math.round(decimal * 100)}`;
  return `${Math.round(-100 / decimal)}`;
}

export function BetCard({ bet, onUpdate, showGame, gameOver }: { bet: Bet; onUpdate: () => void; showGame?: boolean; gameOver?: boolean }) {
  const { authenticated, userId, getAccessToken, login } = useUser();
  const { price } = useChalkPrice();
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showChalkCard, setShowChalkCard] = useState(false);

  const isCreator = userId === bet.creatorId;
  const isTaker = userId === bet.takerId;
  const isParticipant = isCreator || isTaker;
  const isOpen = bet.status === 'open';
  const isMatched = bet.status === 'matched';
  const isSettled = bet.status === 'settled';
  const isCancelled = bet.status === 'cancelled';

  const statLabel = STAT_LABELS[bet.stat] || bet.stat;

  const takerDecimal = bet.creatorStake / bet.takerStake;
  const creatorDecimal = bet.takerStake / bet.creatorStake;
  const takerOdds = toAmericanOdds(takerDecimal);
  const creatorOdds = toAmericanOdds(creatorDecimal);

  async function handleTake() {
    if (!authenticated) { login(); return; }
    setLoading(true);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/bets/take', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ betId: bet.id }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to take prop');
      }
      onUpdate();
    } catch { alert('Failed to take prop'); }
    finally { setLoading(false); }
  }

  async function handleCancel() {
    setLoading(true);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/bets/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ betId: bet.id }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to erase');
      }
      onUpdate();
      setShowModal(false);
    } catch { alert('Failed to erase'); }
    finally { setLoading(false); }
  }

  const pool = bet.creatorStake + bet.takerStake;
  const counterDir = bet.direction === 'over' ? 'under' : 'over';

  // Show from the viewer's perspective:
  // - If viewer is the taker: show taker side (counter direction)
  // - If viewer is the creator: show creator side
  // - If open bet and not creator: show taker side (what they'd be taking)
  // - Otherwise: show creator side
  const showTakerSide = isTaker || (isOpen && !isCreator);
  const displayDir = showTakerSide ? counterDir : bet.direction;
  const displayDirColor = displayDir === 'over' ? 'var(--color-green)' : 'var(--color-red)';
  const displayStake = showTakerSide ? bet.takerStake : bet.creatorStake;
  const displayOdds = showTakerSide ? takerOdds : creatorOdds;

  return (
    <>
      <div
        className="chalk-card rounded-[4px] overflow-hidden transition-all duration-200 cursor-pointer flex flex-col"
        style={{
          opacity: isSettled || isCancelled ? 0.65 : 1,
          ...(isParticipant ? { border: '1.5px dashed rgba(245,217,96,0.35)', boxShadow: '0 0 12px rgba(245,217,96,0.06)' } : {}),
        }}
        onClick={() => setShowModal(true)}
      >
        <div className="px-3 py-2.5 flex flex-col flex-1">
          {/* Header: status + game */}
          <div className="flex items-center justify-between mb-2">
            <StatusBadge status={bet.status} gameOver={gameOver} isMatched={isMatched} />
            {isParticipant && (
              <span className="text-[8px] chalk-header tracking-[0.15em]" style={{ color: 'var(--color-yellow)' }}>YOUR BET</span>
            )}
          </div>

          {showGame && bet.gameTitle && (
            <div className="text-[9px] truncate mb-1.5" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>{bet.gameTitle}</div>
          )}

          {/* Player name */}
          <div className="text-sm chalk-header truncate mb-1.5" style={{ color: 'var(--chalk-white)' }}>{bet.player}</div>

          {/* Prop line: direction + target + stat */}
          <div className="flex items-center gap-1.5 mb-3">
            <span
              className="px-1.5 py-px rounded-[3px] text-[10px] chalk-header tracking-wide"
              style={{ background: `${displayDirColor}15`, color: displayDirColor, border: `1px dashed ${displayDirColor}30` }}
            >
              {displayDir.toUpperCase()}
            </span>
            <span className="text-lg tabular-nums chalk-score" style={{ color: 'var(--chalk-white)' }}>{bet.target}</span>
            <span className="text-[11px] chalk-header tracking-wide" style={{ color: 'var(--chalk-dim)' }}>{statLabel}</span>
          </div>

          {/* Numbers row: Stake / Total Pot / Odds */}
          <div className="flex items-start justify-between gap-1 mt-auto">
            <div>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--chalk-dim)', fontFamily: 'var(--font-chalk-body)' }}>Stake</div>
              <div className="text-lg tabular-nums chalk-score" style={{ color: 'var(--color-yellow)' }}>{displayStake}</div>
              {price !== null && <div className="text-[10px] tabular-nums" style={{ color: 'var(--chalk-ghost)' }}>{formatUsd(displayStake, price)}</div>}
            </div>
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--chalk-dim)', fontFamily: 'var(--font-chalk-body)' }}>Pot</div>
              <div className="text-lg tabular-nums chalk-score" style={{ color: 'var(--color-green)' }}>{pool}</div>
              {price !== null && <div className="text-[10px] tabular-nums" style={{ color: 'var(--chalk-ghost)' }}>{formatUsd(pool, price)}</div>}
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--chalk-dim)', fontFamily: 'var(--font-chalk-body)' }}>Odds</div>
              <div className="text-lg tabular-nums chalk-score" style={{ color: 'var(--chalk-white)' }}>{displayOdds}</div>
            </div>
          </div>

          {/* Settled result */}
          {isSettled && bet.actualValue != null && (
            <div className="mt-2 flex items-center gap-1.5 text-[10px] flex-wrap" style={{ fontFamily: 'var(--font-chalk-body)' }}>
              <span style={{ color: 'var(--chalk-ghost)' }}>Actual:</span>
              <span className="tabular-nums chalk-header" style={{ color: 'var(--chalk-white)' }}>{bet.actualValue} {statLabel}</span>
              <span style={{ color: 'var(--chalk-ghost)' }}>&rarr;</span>
              <span className="chalk-header" style={{ color: bet.result === 'push' ? 'var(--chalk-dim)' : bet.result === 'creator_wins' ? 'var(--color-green)' : 'var(--color-red)' }}>
                {bet.result === 'push' ? 'Push' : bet.result === 'creator_wins' ? `${bet.creatorName} wins` : `${bet.takerName} wins`}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-3 py-2 chalk-stroke-top flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {isMatched && !gameOver && (
              <span className="flex items-center gap-1 text-[9px]" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                </svg>
                Settles at final
              </span>
            )}
            {isMatched && gameOver && (
              <span className="text-[9px] chalk-header tracking-wider" style={{ color: 'var(--color-yellow)' }}>SETTLING...</span>
            )}
            {isSettled && (
              <span className="text-[9px] chalk-header tracking-wider" style={{ color: 'var(--chalk-ghost)' }}>WIPED</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {isOpen && !isCreator && (
              <button
                onClick={(e) => { e.stopPropagation(); handleTake(); }}
                disabled={loading}
                className="chalk-btn chalk-btn-accent px-2.5 py-1 rounded-[4px] text-[10px] chalk-header tracking-wide cursor-pointer disabled:opacity-50"
              >
                {loading ? '...' : `Take ${counterDir.toUpperCase()} ${bet.takerStake}`}
              </button>
            )}
            {authenticated && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowChalkCard(true); }}
                className="chalk-btn px-2 py-1 rounded-[3px] text-[10px] chalk-header cursor-pointer flex items-center gap-1"
                style={{ background: 'rgba(245,217,96,0.12)', border: '1px dashed rgba(245,217,96,0.25)', color: 'var(--color-yellow)' }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
                  <polyline points="16 6 12 2 8 6" />
                  <line x1="12" y1="2" x2="12" y2="15" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Detail modal — portaled to body to escape scroll container clipping */}
      {showModal && createPortal(
        <BetDetailModal
          bet={bet}
          statLabel={statLabel}
          takerOdds={takerOdds}
          creatorOdds={creatorOdds}
          pool={pool}
          isCreator={isCreator}
          isOpen={isOpen}
          loading={loading}
          onCancel={handleCancel}
          onClose={() => setShowModal(false)}
          price={price}
        />,
        document.body
      )}

      {/* Chalk Card modal */}
      {showChalkCard && (
        <ChalkCardModal bet={bet} onClose={() => setShowChalkCard(false)} />
      )}
    </>
  );
}

export function BetDetailModal({ bet, statLabel, takerOdds, creatorOdds, pool, isCreator, isOpen, loading, onCancel, onClose, price }: {
  bet: Bet; statLabel: string; takerOdds: string; creatorOdds: string; pool: number;
  isCreator: boolean; isOpen: boolean; loading: boolean;
  onCancel: () => void; onClose: () => void; price: number | null;
}) {
  const [showShareCard, setShowShareCard] = useState(false);
  const dirColor = bet.direction === 'over' ? 'var(--color-green)' : 'var(--color-red)';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="chalk-card rounded-[4px] w-full max-w-sm overflow-hidden fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px dashed var(--dust-light)' }}>
          <span className="chalk-header text-base" style={{ color: 'var(--chalk-white)' }}>Prop Detail</span>
          <button onClick={onClose} className="p-1 rounded-[4px] cursor-pointer" style={{ color: 'var(--chalk-ghost)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Player + prop */}
          <div>
            <div className="text-lg chalk-header" style={{ color: 'var(--chalk-white)' }}>{bet.player}</div>
            <div className="flex items-center gap-2 mt-1">
              <span
                className="px-1.5 py-px rounded-[2px] text-[9px] chalk-header tracking-wide"
                style={{ background: 'rgba(93,232,138,0.15)', color: 'var(--color-green)', border: '1px dashed rgba(93,232,138,0.3)' }}
              >
                O
              </span>
              <span style={{ color: 'var(--chalk-ghost)', fontSize: '8px' }}>/</span>
              <span
                className="px-1.5 py-px rounded-[2px] text-[9px] chalk-header tracking-wide"
                style={{ background: 'rgba(232,93,93,0.15)', color: 'var(--color-red)', border: '1px dashed rgba(232,93,93,0.3)' }}
              >
                U
              </span>
              <span className="text-2xl tabular-nums chalk-score" style={{ color: 'var(--chalk-white)' }}>{bet.target}</span>
              <span className="text-sm" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>{statLabel}</span>
            </div>
          </div>

          {/* Pot */}
          <div className="text-center py-2.5 rounded-[4px]" style={{ background: 'rgba(232,228,217,0.04)', border: '1px dashed rgba(232,228,217,0.08)' }}>
            <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>Total Pot</div>
            <div className="text-2xl tabular-nums chalk-score" style={{ color: 'var(--chalk-white)' }}>{pool}</div>
            {price !== null && <div className="text-[10px] tabular-nums mt-0.5" style={{ color: 'var(--chalk-dim)', fontFamily: 'var(--font-chalk-body)' }}>{formatUsd(pool, price)}</div>}
          </div>

          {/* Both sides breakdown */}
          <BetSidesBreakdown bet={bet} pool={pool} price={price} creatorOdds={creatorOdds} takerOdds={takerOdds} isCreator={isCreator} />

          {/* Meta */}
          <div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
            <span>By {bet.creatorName}</span>
            {bet.takerName && <><span style={{ opacity: 0.3 }}>|</span><span>Taken by {bet.takerName}</span></>}
            <span style={{ opacity: 0.3 }}>|</span>
            <span className="tabular-nums">{new Date(bet.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => setShowShareCard(true)}
              className="flex-1 py-2.5 rounded-[4px] chalk-header text-sm tracking-wide cursor-pointer transition-all flex items-center justify-center gap-2"
              style={{ background: 'rgba(245,217,96,0.1)', border: '1.5px dashed rgba(245,217,96,0.25)', color: 'var(--color-yellow)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
              Share
            </button>
            {isOpen && isCreator && (
              <button
                onClick={onCancel}
                disabled={loading}
                className="flex-1 py-2.5 rounded-[4px] chalk-header text-sm tracking-wide cursor-pointer disabled:opacity-50 transition-all"
                style={{ background: 'rgba(232,93,93,0.1)', border: '1.5px dashed rgba(232,93,93,0.25)', color: 'var(--color-red)' }}
              >
                {loading ? '...' : 'Erase this prop'}
              </button>
            )}
          </div>
        </div>
      </div>

      {showShareCard && <ChalkCardModal bet={bet} onClose={() => setShowShareCard(false)} />}
    </div>
  );
}

export function BetSidesBreakdown({ bet, pool, price, creatorOdds, takerOdds, isCreator }: { bet: Bet; pool: number; price: number | null; creatorOdds: string; takerOdds: string; isCreator?: boolean }) {
  const counterDir = bet.direction === 'over' ? 'under' : 'over';
  const creatorDirColor = bet.direction === 'over' ? 'var(--color-green)' : 'var(--color-red)';
  const takerDirColor = counterDir === 'over' ? 'var(--color-green)' : 'var(--color-red)';

  const creatorWinPct = pool > 0 ? Math.round((bet.takerStake / pool) * 100) : 50;
  const takerWinPct = pool > 0 ? Math.round((bet.creatorStake / pool) * 100) : 50;

  const creatorProfit = pool - bet.creatorStake;
  const takerProfit = pool - bet.takerStake;

  const rainbow = 'linear-gradient(135deg, #e85d5d, #f5d960, #5de88a, #5db8e8, #b05de8, #e85d5d)';
  const normalBorder = '1px solid rgba(232,228,217,0.08)';

  function SideCard({ highlighted, children }: { highlighted: boolean; children: React.ReactNode }) {
    if (highlighted) {
      return (
        <div className="rounded-[5px] p-[1.5px]" style={{ background: rainbow }}>
          <div className="rounded-[4px] px-3 py-3" style={{ background: 'var(--board-dark)' }}>
            {children}
          </div>
        </div>
      );
    }
    return (
      <div className="rounded-[4px] px-3 py-3" style={{ background: 'rgba(232,228,217,0.03)', border: normalBorder }}>
        {children}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {/* Creator side */}
      <SideCard highlighted={isCreator === true}>
        <div className="flex items-center gap-1.5 mb-2.5">
          <span
            className="px-1.5 py-px rounded-[2px] text-[8px] chalk-header tracking-wide"
            style={{ background: `${creatorDirColor}15`, color: creatorDirColor, border: `1px dashed ${creatorDirColor}30` }}
          >
            {bet.direction.toUpperCase()}
          </span>
          <span className="text-[10px] truncate chalk-header" style={{ color: 'var(--chalk-white)' }}>
            {bet.creatorName}
          </span>
        </div>

        <div className="space-y-2">
          <div>
            <div className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>Stake</div>
            <div className="text-lg tabular-nums chalk-score" style={{ color: 'var(--color-yellow)' }}>{bet.creatorStake}</div>
            {price !== null && <div className="text-[9px] tabular-nums" style={{ color: 'var(--chalk-dim)', fontFamily: 'var(--font-chalk-body)' }}>{formatUsd(bet.creatorStake, price)}</div>}
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>To Win</div>
            <div className="text-lg tabular-nums chalk-score" style={{ color: 'var(--color-green)' }}>{creatorProfit}</div>
            {price !== null && <div className="text-[9px] tabular-nums" style={{ color: 'var(--chalk-dim)', fontFamily: 'var(--font-chalk-body)' }}>{formatUsd(creatorProfit, price)}</div>}
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>Odds</div>
            <div className="text-sm tabular-nums chalk-header" style={{ color: 'var(--chalk-white)' }}>{creatorOdds}</div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>Win %</div>
            <div className="text-sm tabular-nums chalk-header" style={{ color: 'var(--chalk-white)' }}>{creatorWinPct}%</div>
          </div>
        </div>
      </SideCard>

      {/* Taker side */}
      <SideCard highlighted={isCreator === false}>
        <div className="flex items-center gap-1.5 mb-2.5">
          <span
            className="px-1.5 py-px rounded-[2px] text-[8px] chalk-header tracking-wide"
            style={{ background: `${takerDirColor}15`, color: takerDirColor, border: `1px dashed ${takerDirColor}30` }}
          >
            {counterDir.toUpperCase()}
          </span>
          <span className="text-[10px] truncate chalk-header" style={{ color: bet.takerName ? 'var(--chalk-white)' : 'var(--chalk-ghost)' }}>
            {bet.takerName || 'Open'}
          </span>
        </div>

        <div className="space-y-2">
          <div>
            <div className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>Stake</div>
            <div className="text-lg tabular-nums chalk-score" style={{ color: 'var(--color-yellow)' }}>{bet.takerStake}</div>
            {price !== null && <div className="text-[9px] tabular-nums" style={{ color: 'var(--chalk-dim)', fontFamily: 'var(--font-chalk-body)' }}>{formatUsd(bet.takerStake, price)}</div>}
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>To Win</div>
            <div className="text-lg tabular-nums chalk-score" style={{ color: 'var(--color-green)' }}>{takerProfit}</div>
            {price !== null && <div className="text-[9px] tabular-nums" style={{ color: 'var(--chalk-dim)', fontFamily: 'var(--font-chalk-body)' }}>{formatUsd(takerProfit, price)}</div>}
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>Odds</div>
            <div className="text-sm tabular-nums chalk-header" style={{ color: 'var(--chalk-white)' }}>{takerOdds}</div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>Win %</div>
            <div className="text-sm tabular-nums chalk-header" style={{ color: 'var(--chalk-white)' }}>{takerWinPct}%</div>
          </div>
        </div>
      </SideCard>
    </div>
  );
}

function StatusBadge({ status, gameOver, isMatched }: { status: string; gameOver?: boolean; isMatched: boolean }) {
  const config: Record<string, { color: string; label: string }> = {
    open: { color: 'var(--color-green)', label: 'OPEN' },
    matched: { color: 'var(--color-yellow)', label: isMatched && gameOver ? 'FINAL' : 'LIVE' },
    settled: { color: 'var(--chalk-dim)', label: 'WIPED' },
    cancelled: { color: 'var(--chalk-ghost)', label: 'ERASED' },
  };
  const c = config[status] || config.cancelled;
  return (
    <span className="flex-shrink-0 text-[8px] chalk-header tracking-[0.15em]" style={{ color: c.color }}>
      {c.label}
    </span>
  );
}
