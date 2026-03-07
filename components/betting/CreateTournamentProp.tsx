'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser } from '@/hooks/useUser';
import { useChalkPrice, formatUsd } from '@/hooks/useChalkPrice';
import { TournamentTeam, TournamentRound, ROUND_LABELS, ROUND_ORDER } from '@/lib/types';
import { calculateOppositeOdds, calculatePayout, calculateTakerStake, isValidAmericanOdds, formatAmericanOdds } from '@/lib/odds';

const SELECTABLE_ROUNDS: TournamentRound[] = [
  'round_of_32',
  'sweet_16',
  'elite_eight',
  'final_four',
  'championship',
  'win_it_all',
];

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export function CreateTournamentProp({ onClose, onCreated }: Props) {
  const { getAccessToken, profile } = useUser();
  const { price } = useChalkPrice();
  const [teams, setTeams] = useState<TournamentTeam[]>([]);
  const [teamSearch, setTeamSearch] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<TournamentTeam | null>(null);
  const [showTeamDropdown, setShowTeamDropdown] = useState(false);
  const [round, setRound] = useState<TournamentRound>('sweet_16');
  const [direction, setDirection] = useState<'WILL' | 'WILL_NOT'>('WILL');
  const [oddsInput, setOddsInput] = useState('-150');
  const [stake, setStake] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const teamInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/tournament/teams')
      .then((r) => r.json())
      .then((d) => setTeams(d.teams ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        teamInputRef.current && !teamInputRef.current.contains(e.target as Node)
      ) {
        setShowTeamDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const query = teamSearch.trim().toLowerCase();
  const filteredTeams = query
    ? teams.filter((t) => t.name.toLowerCase().includes(query) || t.abbreviation.toLowerCase().includes(query))
    : teams;

  const stakeNum = Number(stake) || 0;
  const oddsNum = Number(oddsInput) || 0;
  const validOdds = isValidAmericanOdds(oddsNum);
  const oppositeOdds = validOdds ? calculateOppositeOdds(oddsNum) : 0;
  const creatorPayout = validOdds ? calculatePayout(stakeNum, oddsNum) : 0;
  const takerStake = validOdds ? calculateTakerStake(stakeNum, oddsNum) : 0;

  const propDescription = selectedTeam
    ? `${selectedTeam.name} ${direction === 'WILL' ? 'WILL' : 'WILL NOT'} make ${ROUND_LABELS[round]}`
    : '';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!selectedTeam) { setError('Select a team'); return; }
    if (stakeNum <= 0) { setError('Enter a valid stake'); return; }
    if (!validOdds) { setError('Odds must be +100 or higher, or -100 or lower'); return; }
    if (profile && stakeNum > profile.coins) { setError('Insufficient chalk'); return; }

    setSubmitting(true);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/bets/create-tournament', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          teamId: selectedTeam.id,
          teamName: selectedTeam.name,
          teamSeed: selectedTeam.seed,
          teamLogo: selectedTeam.logo,
          round,
          direction,
          odds: oddsNum,
          stake: stakeNum,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to create prop');
        return;
      }
      onCreated();
    } catch {
      setError('Failed to create prop');
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
        <div className="flex justify-center pt-3 pb-0 sm:hidden">
          <div className="w-8 h-1 rounded-full" style={{ background: 'var(--dust-medium)' }} />
        </div>

        <div className="p-5 sm:p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--chalk-white)', fontFamily: 'var(--font-chalk-header)' }}>
                <span>🏆</span> Tournament Prop
              </h2>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--chalk-ghost)' }}>NCAA March Madness</p>
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
            {/* Team */}
            <Field label="Team">
              <div className="relative">
                <input
                  ref={teamInputRef}
                  type="text"
                  value={selectedTeam ? `(${selectedTeam.seed}) ${selectedTeam.name}` : teamSearch}
                  onChange={(e) => { setTeamSearch(e.target.value); setSelectedTeam(null); setShowTeamDropdown(true); }}
                  onFocus={() => setShowTeamDropdown(true)}
                  placeholder="Search teams..."
                  className="input-field w-full"
                  autoComplete="off"
                />
                {showTeamDropdown && filteredTeams.length > 0 && (
                  <div
                    ref={dropdownRef}
                    className="absolute z-50 left-0 right-0 top-full mt-1 rounded-[4px] max-h-56 overflow-y-auto scrollbar-hide"
                    style={{ background: 'var(--board-dark)', border: '1px dashed var(--dust-medium)', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}
                  >
                    {filteredTeams.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 cursor-pointer"
                        style={{ color: 'var(--chalk-white)' }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setSelectedTeam(t);
                          setTeamSearch('');
                          setShowTeamDropdown(false);
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--dust-light)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                      >
                        <span className="text-[10px] tabular-nums w-5 text-center flex-shrink-0" style={{ color: 'var(--chalk-ghost)' }}>
                          ({t.seed})
                        </span>
                        {t.logo && (
                          <img src={t.logo} alt="" width={18} height={18} className="flex-shrink-0" />
                        )}
                        <span className="truncate">{t.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Field>

            {/* Round */}
            <Field label="Round Target">
              <select value={round} onChange={(e) => setRound(e.target.value as TournamentRound)} className="input-field w-full">
                {SELECTABLE_ROUNDS.map((r) => (
                  <option key={r} value={r}>{ROUND_LABELS[r]}</option>
                ))}
              </select>
            </Field>

            {/* Direction */}
            <Field label="Your Pick">
              <div className="grid grid-cols-2 gap-2">
                {(['WILL', 'WILL_NOT'] as const).map((d) => {
                  const active = direction === d;
                  const isWill = d === 'WILL';
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDirection(d)}
                      className="py-2.5 rounded-[4px] text-xs font-extrabold uppercase tracking-wider transition-all duration-200 cursor-pointer"
                      style={{
                        background: active
                          ? isWill ? 'rgba(93,232,138,0.12)' : 'rgba(232,93,93,0.12)'
                          : 'var(--dust-light)',
                        border: `1px dashed ${active
                          ? isWill ? 'rgba(93,232,138,0.25)' : 'rgba(232,93,93,0.25)'
                          : 'var(--dust-light)'}`,
                        color: active
                          ? isWill ? 'var(--color-green)' : 'var(--color-red)'
                          : 'var(--chalk-ghost)',
                      }}
                    >
                      {d === 'WILL' ? 'WILL' : 'WILL NOT'}
                    </button>
                  );
                })}
              </div>
            </Field>

            {/* Prop description */}
            {selectedTeam && (
              <div
                className="px-3 py-2.5 rounded-[4px] text-center"
                style={{
                  background: direction === 'WILL' ? 'rgba(93,232,138,0.04)' : 'rgba(232,93,93,0.04)',
                  border: `1px dashed ${direction === 'WILL' ? 'rgba(93,232,138,0.12)' : 'rgba(232,93,93,0.12)'}`,
                }}
              >
                <span className="text-sm chalk-header" style={{ color: 'var(--chalk-white)' }}>
                  &ldquo;{propDescription}&rdquo;
                </span>
              </div>
            )}

            {/* Odds + Stake */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Your Odds" hint="e.g. -150, +200">
                <input
                  type="number"
                  value={oddsInput}
                  onChange={(e) => setOddsInput(e.target.value)}
                  placeholder="-150"
                  className="input-field"
                />
              </Field>
              <Field label="Stake">
                <input
                  type="number"
                  value={stake}
                  onChange={(e) => setStake(e.target.value)}
                  placeholder="50"
                  min="1"
                  className="input-field"
                />
              </Field>
            </div>

            {/* Summary */}
            {stakeNum > 0 && validOdds && (
              <div className="rounded-[4px] overflow-hidden" style={{ border: '1px dashed var(--dust-light)' }}>
                {/* Creator side */}
                <div className="p-3.5" style={{ background: 'var(--dust-light)' }}>
                  <div className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--chalk-ghost)' }}>Your chalk</div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="px-1.5 py-0.5 rounded-[4px] text-[10px] font-extrabold"
                        style={{
                          background: direction === 'WILL' ? 'rgba(93,232,138,0.1)' : 'rgba(232,93,93,0.1)',
                          color: direction === 'WILL' ? 'var(--color-green)' : 'var(--color-red)',
                        }}
                      >
                        {direction === 'WILL' ? 'WILL' : 'WON\'T'}
                      </span>
                      <span className={`text-xs font-bold tabular-nums`} style={{ color: oddsNum > 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                        {formatAmericanOdds(oddsNum)}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-xs" style={{ color: 'var(--chalk-ghost)' }}>
                        Risk <span className="font-bold tabular-nums" style={{ color: 'var(--color-yellow)' }}>{stakeNum}</span>
                        {price !== null && <span className="opacity-50 ml-0.5">({formatUsd(stakeNum, price)})</span>}
                        {' '}&rarr; Win <span className="font-bold tabular-nums" style={{ color: 'var(--color-green)' }}>{creatorPayout}</span>
                        {price !== null && <span className="opacity-50 ml-0.5">({formatUsd(creatorPayout, price)})</span>}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="chalk-divider" />

                {/* Taker side */}
                <div className="p-3.5" style={{ background: 'rgba(232,228,217,0.03)' }}>
                  <div className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--chalk-ghost)' }}>Other side</div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="px-1.5 py-0.5 rounded-[4px] text-[10px] font-extrabold"
                        style={{
                          background: direction === 'WILL' ? 'rgba(232,93,93,0.1)' : 'rgba(93,232,138,0.1)',
                          color: direction === 'WILL' ? 'var(--color-red)' : 'var(--color-green)',
                        }}
                      >
                        {direction === 'WILL' ? 'WON\'T' : 'WILL'}
                      </span>
                      <span className={`text-xs font-bold tabular-nums`} style={{ color: oppositeOdds > 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                        {formatAmericanOdds(oppositeOdds)}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-xs" style={{ color: 'var(--chalk-ghost)' }}>
                        Risk <span className="font-bold tabular-nums" style={{ color: 'var(--color-yellow)' }}>{takerStake}</span>
                        {price !== null && <span className="opacity-50 ml-0.5">({formatUsd(takerStake, price)})</span>}
                        {' '}&rarr; Win <span className="font-bold tabular-nums" style={{ color: 'var(--color-green)' }}>{stakeNum}</span>
                        {price !== null && <span className="opacity-50 ml-0.5">({formatUsd(stakeNum, price)})</span>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Total pool */}
                <div className="px-3.5 py-2.5 flex items-center justify-center" style={{ background: 'rgba(245,217,96,0.04)', borderTop: '1px dashed rgba(245,217,96,0.08)' }}>
                  <span className="text-[10px] font-bold" style={{ color: 'var(--chalk-ghost)' }}>
                    Total Pool: <span className="tabular-nums" style={{ color: 'var(--color-yellow)' }}>{stakeNum + takerStake}</span>
                    {price !== null && <span className="opacity-50 ml-1">({formatUsd(stakeNum + takerStake, price)})</span>}
                  </span>
                </div>
              </div>
            )}

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
