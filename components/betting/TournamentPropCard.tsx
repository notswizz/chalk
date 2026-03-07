'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useUser } from '@/hooks/useUser';
import { useChalkPrice, formatUsd } from '@/hooks/useChalkPrice';
import { TournamentProp, ROUND_LABELS } from '@/lib/types';
import { formatAmericanOdds, calculateOppositeOdds } from '@/lib/odds';

export function TournamentPropCard({ prop, onUpdate }: { prop: TournamentProp; onUpdate: () => void }) {
  const { authenticated, userId, getAccessToken, login } = useUser();
  const { price } = useChalkPrice();
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const isCreator = userId === prop.creatorId;
  const isTaker = userId === prop.takerId;
  const isParticipant = isCreator || isTaker;
  const isOpen = prop.status === 'open';
  const isSettled = prop.status === 'won' || prop.status === 'lost';

  const dirColor = prop.direction === 'WILL' ? 'var(--color-green)' : 'var(--color-red)';
  const takerDir = prop.direction === 'WILL' ? 'WILL NOT' : 'WILL';
  const takerDirColor = prop.direction === 'WILL' ? 'var(--color-red)' : 'var(--color-green)';
  const oppositeOdds = calculateOppositeOdds(prop.odds);

  // Show from viewer's perspective
  const showTakerSide = isTaker || (isOpen && !isCreator);
  const displayDir = showTakerSide ? takerDir : (prop.direction === 'WILL' ? 'WILL' : 'WON\'T');
  const displayDirColor = showTakerSide ? takerDirColor : dirColor;
  const displayStake = showTakerSide ? prop.takerStake : prop.stake;
  const displayOdds = showTakerSide ? oppositeOdds : prop.odds;
  const pool = prop.stake + prop.takerStake;

  async function handleTake() {
    setLoading(true);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/bets/take-tournament', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ propId: prop.id }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to take prop');
      }
      onUpdate();
    } catch { alert('Failed to take prop'); }
    finally { setLoading(false); }
  }

  const statusConfig: Record<string, { color: string; label: string }> = {
    open: { color: 'var(--color-green)', label: 'OPEN' },
    matched: { color: 'var(--color-yellow)', label: 'LIVE' },
    won: { color: 'var(--color-green)', label: 'WON' },
    lost: { color: 'var(--color-red)', label: 'LOST' },
    cancelled: { color: 'var(--chalk-ghost)', label: 'ERASED' },
  };
  const statusInfo = statusConfig[prop.status] || statusConfig.cancelled;

  return (
    <>
      <div
        className="chalk-card rounded-[6px] overflow-hidden transition-all duration-200 flex flex-col"
        style={{
          opacity: isSettled ? 0.65 : 1,
          ...(isParticipant ? { border: '1.5px dashed rgba(245,217,96,0.35)', boxShadow: '0 0 16px rgba(245,217,96,0.06)' } : {}),
        }}
      >
        {/* Team info: logo left, name right — matches BetCard hero section */}
        <div className="relative px-2.5 pt-2.5 pb-2.5" style={{ background: 'linear-gradient(135deg, rgba(232,228,217,0.04), rgba(232,228,217,0.01))' }}>
          {/* Status + YOUR BET badges */}
          <div className="flex items-center justify-between mb-2">
            <StatusBadge status={prop.status} statusInfo={statusInfo} />
            {isParticipant && (
              <span className="text-[7px] chalk-header tracking-[0.15em] px-1.5 py-0.5 rounded-[3px]" style={{ color: 'var(--color-yellow)', background: 'rgba(0,0,0,0.4)' }}>YOUR BET</span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {/* Team logo */}
            <div className="flex-shrink-0">
              {prop.teamLogo ? (
                <img src={prop.teamLogo} alt="" width={52} height={52} className="object-contain" />
              ) : (
                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(232,228,217,0.06)' }}>
                  <span className="text-xl">🏆</span>
                </div>
              )}
            </div>

            {/* Team name */}
            <div className="flex-1 min-w-0">
              <div className="text-[14px] chalk-header truncate" style={{ color: 'var(--chalk-white)' }}>
                ({prop.teamSeed}) {prop.teamName}
              </div>
              <div className="text-[9px] mt-0.5" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
                March Madness
              </div>
            </div>
          </div>
        </div>

        {/* Prop line — direction + round (mirrors player prop's OVER 12.5 PTS row) */}
        <div className="px-2.5 py-2" style={{ borderTop: '1px dashed rgba(232,228,217,0.06)' }}>
          <div className="flex items-center justify-center gap-2">
            <span
              className="px-2 py-0.5 rounded-[3px] text-[10px] chalk-header tracking-wide"
              style={{ background: `${displayDirColor}12`, color: displayDirColor, border: `1px dashed ${displayDirColor}25` }}
            >
              {displayDir}
            </span>
            <span className="text-xl chalk-score" style={{ color: 'var(--chalk-white)' }}>
              {ROUND_LABELS[prop.round]}
            </span>
          </div>
        </div>

        {/* Numbers strip */}
        <div className="flex items-center justify-between px-2.5 py-2" style={{ background: 'rgba(232,228,217,0.02)', borderTop: '1px dashed rgba(232,228,217,0.06)' }}>
          <div className="text-center flex-1">
            <div className="text-base tabular-nums chalk-score" style={{ color: 'var(--color-yellow)' }}>{displayStake}</div>
            <div className="text-[8px] uppercase tracking-wider" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>Stake</div>
          </div>
          <div className="w-px h-6" style={{ background: 'rgba(232,228,217,0.08)' }} />
          <div className="text-center flex-1">
            <div className="text-base tabular-nums chalk-score" style={{ color: 'var(--color-green)' }}>{pool}</div>
            <div className="text-[8px] uppercase tracking-wider" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>Pot</div>
          </div>
          <div className="w-px h-6" style={{ background: 'rgba(232,228,217,0.08)' }} />
          <div className="text-center flex-1">
            <div className="text-base tabular-nums chalk-score" style={{ color: 'var(--chalk-white)' }}>{formatAmericanOdds(displayOdds)}</div>
            <div className="text-[8px] uppercase tracking-wider" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>Odds</div>
          </div>
        </div>

        {/* Settlement info */}
        {isSettled && prop.settledRound && (
          <div className="px-2.5 py-1.5 flex items-center justify-center text-[10px]" style={{ borderTop: '1px dashed rgba(232,228,217,0.06)', fontFamily: 'var(--font-chalk-body)' }}>
            <span style={{ color: 'var(--chalk-ghost)' }}>
              {prop.settledRound === 'champion' ? 'Won Tournament' : `Eliminated in ${prop.settledRound.replace(/_/g, ' ')}`}
            </span>
          </div>
        )}

        {/* Footer */}
        <div className="px-2.5 py-2 flex items-center justify-between" style={{ borderTop: '1px dashed rgba(232,228,217,0.06)' }}>
          <span className="text-[9px] truncate" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
            {prop.creatorName}
          </span>
          {isOpen && !isCreator && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!authenticated) { login(); return; }
                setShowConfirm(true);
              }}
              disabled={loading}
              className="chalk-btn chalk-btn-accent px-2.5 py-1 rounded-[4px] text-[10px] chalk-header tracking-wide cursor-pointer disabled:opacity-50"
            >
              {loading ? '...' : 'Take It'}
            </button>
          )}
        </div>
      </div>

      {/* Confirm modal — portaled */}
      {showConfirm && createPortal(
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowConfirm(false)}
        >
          <div className="chalk-card rounded-[4px] w-full max-w-xs overflow-hidden fade-up" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3" style={{ borderBottom: '1px dashed var(--dust-light)' }}>
              <span className="chalk-header text-base" style={{ color: 'var(--chalk-white)' }}>Confirm Tournament Prop</span>
            </div>
            <div className="p-4 space-y-3">
              <div className="text-sm" style={{ color: 'var(--chalk-white)', fontFamily: 'var(--font-chalk-body)' }}>
                You&apos;re taking:{' '}
                <span className="chalk-header" style={{ color: takerDirColor }}>{takerDir}</span>{' '}
                make {ROUND_LABELS[prop.round]} for{' '}
                <span className="chalk-header">({prop.teamSeed}) {prop.teamName}</span>
              </div>

              <div className="flex items-center justify-between py-2 px-3 rounded-[4px]" style={{ background: 'rgba(232,228,217,0.04)', border: '1px dashed rgba(232,228,217,0.08)' }}>
                <div>
                  <div className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>Your Stake</div>
                  <div className="text-lg tabular-nums chalk-score" style={{ color: 'var(--color-yellow)' }}>{prop.takerStake}</div>
                </div>
                <div className="text-lg" style={{ color: 'var(--chalk-ghost)' }}>&rarr;</div>
                <div className="text-right">
                  <div className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>Total Pot</div>
                  <div className="text-lg tabular-nums chalk-score" style={{ color: 'var(--color-green)' }}>{pool}</div>
                </div>
              </div>

              <div className="text-[10px]" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
                vs {prop.creatorName} &middot; Odds: {formatAmericanOdds(oppositeOdds)}
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 py-2.5 rounded-[4px] chalk-header text-sm tracking-wide cursor-pointer"
                  style={{ background: 'rgba(232,228,217,0.06)', border: '1px dashed rgba(232,228,217,0.12)', color: 'var(--chalk-dim)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => { setShowConfirm(false); handleTake(); }}
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-[4px] chalk-header text-sm tracking-wide cursor-pointer disabled:opacity-50"
                  style={{ background: 'rgba(93,232,138,0.15)', border: '1.5px dashed rgba(93,232,138,0.3)', color: 'var(--color-green)' }}
                >
                  {loading ? '...' : 'Lock it in'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

function StatusBadge({ status, statusInfo }: { status: string; statusInfo: { color: string; label: string } }) {
  return (
    <span className="flex-shrink-0 text-[8px] chalk-header tracking-[0.15em]" style={{ color: statusInfo.color }}>
      {statusInfo.label}
    </span>
  );
}
