'use client';

import { useState } from 'react';
import { useUser } from '@/hooks/useUser';

const STATS = [
  { value: 'points', label: 'Points' },
  { value: 'rebounds', label: 'Rebounds' },
  { value: 'assists', label: 'Assists' },
  { value: 'threes', label: '3-Pointers' },
];

interface Props {
  gameId: string;
  gameTitle: string;
  onClose: () => void;
  onCreated: () => void;
}

function americanToMultiplier(american: number): number {
  if (american > 0) return american / 100;
  return 100 / Math.abs(american);
}

function multiplierToAmerican(mult: number): string {
  if (mult >= 1) return `-${Math.round(mult * 100)}`;
  return `+${Math.round(100 / mult)}`;
}

function formatAmerican(val: number): string {
  return val > 0 ? `+${val}` : `${val}`;
}

export function CreateBetModal({ gameId, gameTitle, onClose, onCreated }: Props) {
  const { getAccessToken, profile } = useUser();
  const [player, setPlayer] = useState('');
  const [stat, setStat] = useState('points');
  const [target, setTarget] = useState('');
  const [direction, setDirection] = useState<'over' | 'under'>('over');
  const [stake, setStake] = useState('');
  const [oddsInput, setOddsInput] = useState('-110');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const stakeNum = Number(stake) || 0;
  const oddsNum = Number(oddsInput) || 0;
  const isValidOdds = oddsNum !== 0 && (oddsNum >= 100 || oddsNum <= -100);
  const multiplier = isValidOdds ? americanToMultiplier(oddsNum) : 1;
  const takerStake = Math.round(stakeNum * multiplier);
  const payout = stakeNum + takerStake;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!player.trim()) { setError('Enter a player name'); return; }
    if (!target || Number(target) <= 0) { setError('Enter a valid target'); return; }
    if (stakeNum <= 0) { setError('Enter a valid stake'); return; }
    if (!isValidOdds) { setError('Odds must be +100 or higher, or -100 or lower'); return; }
    if (profile && stakeNum > profile.coins) { setError('Insufficient chalk'); return; }

    setSubmitting(true);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/bets/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          gameId, gameTitle, gameDate: new Date().toISOString(),
          player: player.trim(), stat, target: Number(target), direction, stake: stakeNum, odds: multiplier,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to draw up prop');
        return;
      }
      onCreated();
    } catch {
      setError('Failed to draw up prop');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
      <div
        className="relative w-full max-w-md rounded-t-[8px] sm:rounded-[8px] max-h-[90vh] overflow-y-auto"
        style={{
          background: 'linear-gradient(180deg, var(--board-medium), var(--board-dark))',
          border: '1px dashed var(--dust-medium)',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.4)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar (mobile) */}
        <div className="flex justify-center pt-3 pb-0 sm:hidden">
          <div className="w-8 h-1 rounded-full" style={{ background: 'var(--dust-medium)' }} />
        </div>

        <div className="p-5 sm:p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-bold" style={{ color: 'var(--chalk-white)', fontFamily: 'var(--font-chalk-header)' }}>Draw Up a Prop</h2>
              <p className="text-[10px] mt-0.5 truncate max-w-[250px]" style={{ color: 'var(--chalk-ghost)' }}>{gameTitle}</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-[4px] transition-colors cursor-pointer"
              style={{ color: 'var(--chalk-ghost)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Player */}
            <Field label="Player">
              <input
                type="text"
                value={player}
                onChange={(e) => setPlayer(e.target.value)}
                placeholder="e.g. LeBron James"
                className="input-field"
              />
            </Field>

            {/* Stat + Target */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Stat">
                <select value={stat} onChange={(e) => setStat(e.target.value)} className="input-field">
                  {STATS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Target">
                <input
                  type="number"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder="25.5"
                  step="0.5"
                  className="input-field"
                />
              </Field>
            </div>

            {/* Direction */}
            <Field label="Direction">
              <div className="grid grid-cols-2 gap-2">
                {(['over', 'under'] as const).map((d) => {
                  const active = direction === d;
                  const isOver = d === 'over';
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDirection(d)}
                      className="py-2.5 rounded-[4px] text-xs font-extrabold uppercase tracking-wider transition-all duration-200 cursor-pointer"
                      style={{
                        background: active
                          ? isOver ? 'rgba(93,232,138,0.12)' : 'rgba(232,93,93,0.12)'
                          : 'var(--dust-light)',
                        border: `1px dashed ${active
                          ? isOver ? 'rgba(93,232,138,0.25)' : 'rgba(232,93,93,0.25)'
                          : 'var(--dust-light)'}`,
                        color: active
                          ? isOver ? 'var(--color-green)' : 'var(--color-red)'
                          : 'var(--chalk-ghost)',
                      }}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </Field>

            {/* Stake + Odds */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Your Stake">
                <input
                  type="number"
                  value={stake}
                  onChange={(e) => setStake(e.target.value)}
                  placeholder="50"
                  min="1"
                  className="input-field"
                />
              </Field>
              <Field label="Odds" hint="e.g. -110, +150">
                <input
                  type="number"
                  value={oddsInput}
                  onChange={(e) => setOddsInput(e.target.value)}
                  placeholder="-110"
                  className="input-field"
                />
              </Field>
            </div>

            {/* Summary */}
            {stakeNum > 0 && isValidOdds && (() => {
              const counterOdds = multiplierToAmerican(multiplier);
              const counterDirection = direction === 'over' ? 'UNDER' : 'OVER';
              return (
                <div
                  className="rounded-[4px] overflow-hidden"
                  style={{ border: '1px dashed var(--dust-light)' }}
                >
                  {/* Your side */}
                  <div className="p-3.5" style={{ background: 'var(--dust-light)' }}>
                    <div className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--chalk-ghost)' }}>Your chalk</div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="px-1.5 py-0.5 rounded-[4px] text-[10px] font-extrabold"
                          style={{
                            background: direction === 'over' ? 'rgba(93,232,138,0.1)' : 'rgba(232,93,93,0.1)',
                            color: direction === 'over' ? 'var(--color-green)' : 'var(--color-red)',
                          }}
                        >
                          {direction.toUpperCase()}
                        </span>
                        <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--chalk-dim)' }}>{target || '?'}</span>
                        <span className={`text-xs font-bold tabular-nums`} style={{ color: oddsNum > 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                          {formatAmerican(oddsNum)}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-xs" style={{ color: 'var(--chalk-ghost)' }}>
                          Risk <span className="font-bold tabular-nums" style={{ color: 'var(--color-yellow)' }}>{stakeNum}</span>
                          {' '}&rarr; Win <span className="font-bold tabular-nums" style={{ color: 'var(--color-green)' }}>{takerStake}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="chalk-divider" />

                  {/* Counter-bettor side */}
                  <div className="p-3.5" style={{ background: 'rgba(232,228,217,0.03)' }}>
                    <div className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--chalk-ghost)' }}>Other side</div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="px-1.5 py-0.5 rounded-[4px] text-[10px] font-extrabold"
                          style={{
                            background: counterDirection === 'OVER' ? 'rgba(93,232,138,0.1)' : 'rgba(232,93,93,0.1)',
                            color: counterDirection === 'OVER' ? 'var(--color-green)' : 'var(--color-red)',
                          }}
                        >
                          {counterDirection}
                        </span>
                        <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--chalk-dim)' }}>{target || '?'}</span>
                        <span className={`text-xs font-bold tabular-nums`} style={{ color: counterOdds.startsWith('+') ? 'var(--color-green)' : 'var(--color-red)' }}>
                          {counterOdds}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-xs" style={{ color: 'var(--chalk-ghost)' }}>
                          Risk <span className="font-bold tabular-nums" style={{ color: 'var(--color-yellow)' }}>{takerStake}</span>
                          {' '}&rarr; Win <span className="font-bold tabular-nums" style={{ color: 'var(--color-green)' }}>{stakeNum}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Total pool */}
                  <div className="px-3.5 py-2.5 flex items-center justify-center" style={{ background: 'rgba(245,217,96,0.04)', borderTop: '1px dashed rgba(245,217,96,0.08)' }}>
                    <span className="text-[10px] font-bold" style={{ color: 'var(--chalk-ghost)' }}>
                      Total Pool: <span className="tabular-nums" style={{ color: 'var(--color-yellow)' }}>{payout}</span>
                    </span>
                  </div>
                </div>
              );
            })()}

            {error && (
              <div className="px-3 py-2 rounded-[4px] text-xs font-medium" style={{ background: 'rgba(232,93,93,0.06)', border: '1px dashed rgba(232,93,93,0.1)', color: 'var(--color-red)' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-[4px] text-sm font-bold transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 cursor-pointer"
              style={{
                background: 'rgba(245,217,96,0.15)',
                border: '1px dashed rgba(245,217,96,0.25)',
                color: 'var(--color-yellow)',
              }}
            >
              {submitting ? 'Drawing up...' : 'Put it on the Board'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--chalk-ghost)' }}>{label}</label>
        {hint && <span className="text-[9px]" style={{ color: 'var(--chalk-ghost)' }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}
