'use client';

import { useUser } from '@/hooks/useUser';
import { useChalkPrice, formatUsd } from '@/hooks/useChalkPrice';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChalkCardModal } from '@/components/chalk-cards/ChalkCardModal';

interface Validation {
  userId: string;
  actualValue: number;
  timestamp: number;
}

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
  validations?: Validation[];
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
  const [showValidate, setShowValidate] = useState(false);
  const [showChalkCard, setShowChalkCard] = useState(false);
  const [actualValue, setActualValue] = useState('');
  const [validateError, setValidateError] = useState('');

  const isCreator = userId === bet.creatorId;
  const isTaker = userId === bet.takerId;
  const isParticipant = isCreator || isTaker;
  const isOpen = bet.status === 'open';
  const isMatched = bet.status === 'matched';
  const isSettled = bet.status === 'settled';
  const isCancelled = bet.status === 'cancelled';

  const validations = bet.validations ?? [];
  const validationCount = validations.length;
  const alreadyValidated = validations.some((v) => v.userId === userId);
  const canValidate = isMatched && !!gameOver && !isParticipant && !alreadyValidated && authenticated;

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

  async function handleValidate() {
    if (!authenticated) { login(); return; }
    setValidateError('');
    const val = Number(actualValue);
    if (isNaN(val) || actualValue.trim() === '') {
      setValidateError('Enter the actual stat value');
      return;
    }
    setLoading(true);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/bets/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ betId: bet.id, actualValue: val }),
      });
      if (!res.ok) {
        const data = await res.json();
        setValidateError(data.error || 'Failed to score check');
      } else {
        setShowValidate(false);
        onUpdate();
      }
    } catch { setValidateError('Failed to score check'); }
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
  const displayToWin = pool - displayStake;
  const displayOdds = showTakerSide ? takerOdds : creatorOdds;

  return (
    <>
      <div
        className="chalk-card rounded-[4px] overflow-hidden transition-all duration-200 cursor-pointer"
        style={{
          opacity: isSettled || isCancelled ? 0.65 : 1,
          ...(isParticipant ? { border: '1.5px dashed rgba(245,217,96,0.35)', boxShadow: '0 0 12px rgba(245,217,96,0.06)' } : {}),
        }}
        onClick={() => setShowModal(true)}
      >
        <div className="px-3 py-2.5">
          {/* Top meta row */}
          {(showGame && bet.gameTitle || isParticipant) && (
            <div className="flex items-center gap-2 mb-1.5">
              {showGame && bet.gameTitle && (
                <span className="text-[9px] truncate" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>{bet.gameTitle}</span>
              )}
              {isParticipant && (
                <span className="text-[8px] chalk-header tracking-[0.15em] flex-shrink-0" style={{ color: 'var(--color-yellow)' }}>YOUR BET</span>
              )}
            </div>
          )}

          {/* Main row: player + prop on left, stake/to-win on right */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm truncate chalk-header" style={{ color: 'var(--chalk-white)' }}>{bet.player}</span>
                <StatusBadge status={bet.status} gameOver={gameOver} isMatched={isMatched} />
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className="px-1.5 py-px rounded-[3px] text-[10px] chalk-header tracking-wide"
                  style={{ background: `${displayDirColor}15`, color: displayDirColor, border: `1px dashed ${displayDirColor}30` }}
                >
                  {displayDir.toUpperCase()}
                </span>
                <span className="text-base tabular-nums chalk-score" style={{ color: 'var(--chalk-white)' }}>{bet.target}</span>
                <span className="text-[10px]" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>{statLabel}</span>
              </div>
            </div>

            <div className="flex-shrink-0 flex items-start gap-3 text-right">
              <div>
                <div className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>Stake</div>
                <div className="text-xl tabular-nums chalk-score" style={{ color: 'var(--color-yellow)' }}>{displayStake}</div>
                {price !== null && <div className="text-[9px] tabular-nums opacity-50" style={{ color: 'var(--chalk-dim)' }}>{formatUsd(displayStake, price)}</div>}
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>To Win</div>
                <div className="text-xl tabular-nums chalk-score" style={{ color: 'var(--color-green)' }}>{displayToWin}</div>
                {price !== null && <div className="text-[9px] tabular-nums opacity-50" style={{ color: 'var(--chalk-dim)' }}>{formatUsd(displayToWin, price)}</div>}
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>Odds</div>
                <div className="text-xl tabular-nums chalk-score" style={{ color: 'var(--chalk-white)' }}>{displayOdds}</div>
              </div>
            </div>
          </div>

          {/* Settled result */}
          {isSettled && bet.actualValue != null && (
            <div className="mt-2 flex items-center gap-1.5 text-[10px]" style={{ fontFamily: 'var(--font-chalk-body)' }}>
              <span style={{ color: 'var(--chalk-ghost)' }}>Actual:</span>
              <span className="tabular-nums chalk-header" style={{ color: 'var(--chalk-white)' }}>{bet.actualValue} {statLabel}</span>
              <span style={{ color: 'var(--chalk-ghost)' }}>&rarr;</span>
              <span className="chalk-header" style={{ color: bet.result === 'push' ? 'var(--chalk-dim)' : bet.result === 'creator_wins' ? 'var(--color-green)' : 'var(--color-red)' }}>
                {bet.result === 'push' ? 'Push' : bet.result === 'creator_wins' ? `${bet.creatorName} wins` : `${bet.takerName} wins`}
              </span>
            </div>
          )}

          {/* Footer row */}
          <div className="flex items-center justify-end mt-2 pt-2 chalk-stroke-top">
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

              {isMatched && gameOver && (
                <AutoSettleCountdown betId={bet.id} />
              )}

              {isMatched && (
                <ValidationSection
                  gameOver={gameOver}
                  validationCount={validationCount}
                  canValidate={canValidate}
                  alreadyValidated={alreadyValidated}
                  showValidate={showValidate}
                  setShowValidate={setShowValidate}
                  isParticipant={isParticipant}
                  authenticated={authenticated}
                  login={login}
                />
              )}

              {isSettled && (
                <span className="text-[9px] chalk-header tracking-wider" style={{ color: 'var(--chalk-ghost)' }}>WIPED</span>
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

        {/* Validate form (expanded) */}
        {showValidate && (
          <div className="px-3 pb-2.5" onClick={(e) => e.stopPropagation()}>
            <div className="p-2.5 rounded-[4px]" style={{ background: 'rgba(245,217,96,0.04)', border: '1px dashed rgba(245,217,96,0.1)' }}>
              <div className="text-[9px] chalk-header uppercase tracking-wider mb-2" style={{ color: 'rgba(245,217,96,0.6)' }}>
                What did {bet.player} finish with?
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={actualValue}
                  onChange={(e) => { setActualValue(e.target.value); setValidateError(''); }}
                  placeholder={`Actual ${statLabel}`}
                  step="1"
                  className="input-field flex-1 !py-1.5 !text-sm"
                />
                <button
                  onClick={handleValidate}
                  disabled={loading}
                  className="chalk-btn chalk-btn-accent px-3 py-1.5 rounded-[4px] text-[10px] chalk-header cursor-pointer disabled:opacity-50"
                >
                  {loading ? '...' : 'Submit'}
                </button>
                <button
                  onClick={() => setShowValidate(false)}
                  className="p-1.5 rounded-[4px] cursor-pointer"
                  style={{ color: 'var(--chalk-ghost)' }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {actualValue && !isNaN(Number(actualValue)) && (
                <div className="flex items-center gap-1.5 mt-2 text-[9px]" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
                  <span className="tabular-nums">{Number(actualValue)} {statLabel}</span>
                  <span>&rarr;</span>
                  <span className="tabular-nums">target {bet.target}</span>
                  <span>&rarr;</span>
                  {Number(actualValue) === bet.target ? (
                    <span style={{ color: 'var(--chalk-dim)' }}>Push</span>
                  ) : Number(actualValue) > bet.target ? (
                    <span style={{ color: 'var(--color-green)' }}>OVER &rarr; {bet.direction === 'over' ? bet.creatorName : bet.takerName} wins</span>
                  ) : (
                    <span style={{ color: 'var(--color-red)' }}>UNDER &rarr; {bet.direction === 'under' ? bet.creatorName : bet.takerName} wins</span>
                  )}
                </div>
              )}
              {validateError && <p className="text-[10px] mt-1.5" style={{ color: 'var(--color-red)', fontFamily: 'var(--font-chalk-body)' }}>{validateError}</p>}
            </div>
          </div>
        )}
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
                className="px-2 py-0.5 rounded-[3px] text-xs chalk-header tracking-wide"
                style={{ background: `${dirColor}15`, color: dirColor, border: `1px dashed ${dirColor}30` }}
              >
                {bet.direction.toUpperCase()}
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
          {isOpen && isCreator && (
            <button
              onClick={onCancel}
              disabled={loading}
              className="w-full py-2.5 rounded-[4px] chalk-header text-sm tracking-wide cursor-pointer disabled:opacity-50 transition-all"
              style={{ background: 'rgba(232,93,93,0.1)', border: '1.5px dashed rgba(232,93,93,0.25)', color: 'var(--color-red)' }}
            >
              {loading ? '...' : 'Erase this prop'}
            </button>
          )}
        </div>
      </div>
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
    matched: { color: 'var(--color-yellow)', label: isMatched && gameOver ? 'SCORE CHECK' : 'LIVE' },
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

function ValidationSection({
  gameOver, validationCount, canValidate, alreadyValidated, showValidate, setShowValidate, isParticipant, authenticated, login,
}: {
  gameOver?: boolean; validationCount: number; canValidate: boolean; alreadyValidated: boolean;
  showValidate: boolean; setShowValidate: (v: boolean) => void; isParticipant: boolean; authenticated: boolean; login: () => void;
}) {
  if (!gameOver) {
    return (
      <span className="flex items-center gap-1 text-[9px]" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
        </svg>
        After buzzer
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-[2px]">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-[5px] h-[5px] rounded-full"
            style={{ background: i < validationCount ? 'var(--color-yellow)' : 'var(--dust-medium)' }}
          />
        ))}
      </div>

      {canValidate && !showValidate && (
        <button
          onClick={(e) => { e.stopPropagation(); setShowValidate(true); }}
          className="chalk-btn chalk-btn-accent px-2 py-0.5 rounded-[3px] text-[9px] chalk-header cursor-pointer"
        >
          Check
        </button>
      )}

      {gameOver && !isParticipant && !authenticated && !showValidate && (
        <button
          onClick={(e) => { e.stopPropagation(); login(); }}
          className="chalk-btn chalk-btn-accent px-2 py-0.5 rounded-[3px] text-[9px] chalk-header cursor-pointer"
        >
          Check
        </button>
      )}

      {alreadyValidated && (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--color-green)" strokeWidth="3">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      )}
    </div>
  );
}

const AUTO_SETTLE_MS = 30 * 60 * 1000;

function AutoSettleCountdown({ betId }: { betId: string }) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const key = `autosettle-${betId}`;
    let startTime = Number(localStorage.getItem(key));
    if (!startTime) {
      startTime = Date.now();
      localStorage.setItem(key, String(startTime));
    }

    function tick() {
      const elapsed = Date.now() - startTime;
      const left = Math.max(0, AUTO_SETTLE_MS - elapsed);
      setRemaining(left);
    }

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [betId]);

  if (remaining === null) return null;

  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  const isComplete = remaining === 0;

  return (
    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-[3px]"
      style={{ background: isComplete ? 'rgba(93,232,138,0.08)' : 'rgba(232,228,217,0.04)' }}
    >
      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
        style={{ color: isComplete ? 'var(--color-green)' : 'var(--chalk-ghost)' }}
      >
        <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
      </svg>
      {isComplete ? (
        <span className="text-[9px]" style={{ color: 'var(--color-green)', fontFamily: 'var(--font-chalk-body)' }}>Auto-settling</span>
      ) : (
        <span className="countdown-tick text-[9px]" style={{ color: 'var(--chalk-dim)' }}>
          {mins}<span className="countdown-colon">:</span>{secs.toString().padStart(2, '0')}
        </span>
      )}
    </div>
  );
}
