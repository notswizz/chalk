'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser } from '@/hooks/useUser';
import { useChalkPrice, formatUsd } from '@/hooks/useChalkPrice';

interface PlayerInfo {
  id: string;
  name: string;
  position: string;
  jersey: string;
}

interface SeasonAverages {
  points: number;
  rebounds: number;
  assists: number;
  threes: number;
  season: string;
}

const STATS = [
  { value: 'points', label: 'Points', abbr: 'PTS' },
  { value: 'rebounds', label: 'Rebounds', abbr: 'REB' },
  { value: 'assists', label: 'Assists', abbr: 'AST' },
  { value: 'threes', label: '3-Pointers', abbr: '3PM' },
];

interface Props {
  gameId: string;
  gameTitle: string;
  teams?: string[];
  teamIds?: string[];
  sport?: string;
  gameLive?: boolean;
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

export function CreateBetModal({ gameId, gameTitle, teams, teamIds, sport, gameLive, onClose, onCreated }: Props) {
  const { getAccessToken, profile } = useUser();
  const { price } = useChalkPrice();
  const [player, setPlayer] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [playerTeam, setPlayerTeam] = useState('');
  const [playersByTeam, setPlayersByTeam] = useState<Record<string, PlayerInfo[]>>({});
  const [showSuggestions, setShowSuggestions] = useState(false);
  const playerInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const [stat, setStat] = useState('points');
  const [averages, setAverages] = useState<SeasonAverages | null>(null);
  const [liveStats, setLiveStats] = useState<Record<string, number> | null>(null);
  const [target, setTarget] = useState('');
  const [direction, setDirection] = useState<'over' | 'under'>('over');
  const [stake, setStake] = useState('');
  const [oddsInput, setOddsInput] = useState('-110');
  const [oddsMode, setOddsMode] = useState<'american' | 'percent'>('american');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Fetch live stats for selected player when game is live
  useEffect(() => {
    if (!gameLive || !player) { setLiveStats(null); return; }
    fetch(`/api/bets/live-stats?gameId=${gameId}&sport=${sport || 'nba'}`)
      .then((r) => r.json())
      .then((data) => {
        const stats = data.stats ?? {};
        const key = player.toLowerCase();
        if (stats[key]) { setLiveStats(stats[key]); return; }
        // Try last name match
        const lastName = key.split(' ').pop() || '';
        for (const [name, s] of Object.entries(stats)) {
          if (name.split(' ').pop() === lastName) { setLiveStats(s as Record<string, number>); return; }
        }
        setLiveStats(null);
      })
      .catch(() => setLiveStats(null));
  }, [gameLive, player, gameId, sport]);

  // Fetch rosters for both teams
  useEffect(() => {
    if (!teams || teams.length === 0) return;
    const sportParam = sport ? `&sport=${sport}` : '';
    setPlayersByTeam({});
    setPlayer('');
    setPlayerId('');
    setPlayerTeam('');
    // For NCAA, use numeric team IDs since abbreviations don't work reliably
    const rosterKeys = sport === 'ncaam' && teamIds?.length ? teamIds : teams;
    const displayKeys = teams; // Always use abbreviations as display keys
    fetch(`/api/players?teams=${(rosterKeys || []).join(',')}&displayTeams=${(displayKeys || []).join(',')}${sportParam}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setPlayersByTeam(d.byTeam ?? {}))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams?.join(','), teamIds?.join(','), sport]);

  // Fetch season averages when player is selected
  useEffect(() => {
    if (!playerId) { setAverages(null); return; }
    const sportParam = sport ? `&sport=${sport}` : '';
    fetch(`/api/players/averages?id=${playerId}${sportParam}`)
      .then((r) => r.json())
      .then((d) => setAverages(d.averages ?? null))
      .catch(() => setAverages(null));
  }, [playerId, sport]);

  // Close suggestions on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
        playerInputRef.current && !playerInputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const teamEntries = Object.entries(playersByTeam);
  const hasPlayers = teamEntries.some(([, players]) => players.length > 0);
  const query = player.trim().toLowerCase();
  const filteredByTeam = teamEntries
    .map(([team, players]) => ({
      team,
      players: query ? players.filter((p) => p.name.toLowerCase().includes(query)) : players,
    }))
    .filter((g) => g.players.length > 0);

  const stakeNum = Number(stake) || 0;
  const oddsNum = Number(oddsInput) || 0;

  // Compute validity and multiplier based on mode
  const isValidOdds = oddsMode === 'american'
    ? oddsNum !== 0 && (oddsNum >= 100 || oddsNum <= -100)
    : oddsNum > 0 && oddsNum < 100;
  const multiplier = !isValidOdds ? 1
    : oddsMode === 'american' ? americanToMultiplier(oddsNum)
    : (100 - oddsNum) / oddsNum; // percent = implied win probability → multiplier
  const americanDisplay = oddsMode === 'american' ? oddsNum
    : multiplier >= 1 ? Math.round(multiplier * 100) * -1 : Math.round(100 / multiplier);
  const percentDisplay = oddsMode === 'percent' ? oddsNum
    : isValidOdds ? Math.round(100 / (1 + multiplier)) : 0;
  const takerStake = Math.round(stakeNum * multiplier);
  const payout = stakeNum + takerStake;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!player.trim()) { setError('Enter a player name'); return; }
    if (!target || Number(target) <= 0) { setError('Enter a valid target'); return; }
    if (stakeNum <= 0) { setError('Enter a valid stake'); return; }
    if (!isValidOdds) { setError(oddsMode === 'american' ? 'Odds must be +100 or higher, or -100 or lower' : 'Win % must be between 1 and 99'); return; }
    if (profile && stakeNum > profile.coins) { setError('Insufficient chalk'); return; }

    setSubmitting(true);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/bets/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          gameId, gameTitle, gameDate: new Date().toISOString(),
          player: player.trim(), playerId: playerId || '', playerTeam: playerTeam || '',
          awayTeam: teams?.[0] || '', homeTeam: teams?.[1] || '',
          stat, target: Number(target), direction, stake: stakeNum, odds: multiplier,
          sport: sport || 'nba',
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

        <div className="p-4 sm:p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold" style={{ color: 'var(--chalk-white)', fontFamily: 'var(--font-chalk-header)' }}>Draw Up a Prop</h2>
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

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Player */}
            <Field label="Player">
              <div className="relative">
                <input
                  ref={playerInputRef}
                  type="text"
                  value={player}
                  onChange={(e) => { setPlayer(e.target.value); setPlayerId(''); setPlayerTeam(''); setShowSuggestions(true); }}
                  onFocus={() => setShowSuggestions(true)}
                  placeholder={hasPlayers ? 'Search player...' : 'e.g. LeBron James'}
                  className="input-field w-full"
                  autoComplete="off"
                />
                {showSuggestions && filteredByTeam.length > 0 && (
                  <div
                    ref={suggestionsRef}
                    className="absolute z-50 left-0 right-0 top-full mt-1 rounded-[4px] max-h-56 overflow-y-auto scrollbar-hide"
                    style={{ background: 'var(--board-dark)', border: '1px dashed var(--dust-medium)', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}
                  >
                    {filteredByTeam.map(({ team, players }, gi) => (
                      <div key={team}>
                        {gi > 0 && <div style={{ borderTop: '1px dashed var(--dust-light)' }} />}
                        <div
                          className="px-3 py-1.5 sticky top-0"
                          style={{ background: 'var(--board-dark)', borderBottom: '1px dashed rgba(232,228,217,0.06)' }}
                        >
                          <span className="text-[9px] font-bold uppercase tracking-[0.15em]" style={{ color: 'var(--chalk-ghost)' }}>
                            {team}
                          </span>
                        </div>
                        {players.map((p) => (
                          <button
                            key={`${team}-${p.name}`}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 cursor-pointer"
                            style={{ color: 'var(--chalk-white)' }}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setPlayer(p.name);
                              setPlayerId(p.id);
                              setPlayerTeam(team);
                              setShowSuggestions(false);
                            }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--dust-light)'; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                          >
                            {p.jersey && (
                              <span className="text-[10px] tabular-nums w-5 text-center flex-shrink-0" style={{ color: 'var(--chalk-ghost)' }}>
                                #{p.jersey}
                              </span>
                            )}
                            <span className="truncate">{p.name}</span>
                            {p.position && (
                              <span className="text-[10px] flex-shrink-0 ml-auto" style={{ color: 'var(--chalk-ghost)' }}>
                                {p.position}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
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

            {/* Season average hint */}
            {averages && (
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-[4px]"
                style={{ background: 'rgba(245,217,96,0.04)', border: '1px dashed rgba(245,217,96,0.1)' }}
              >
                <span className="text-[10px]" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
                  {averages.season} avg:
                </span>
                <span className="text-sm tabular-nums font-bold" style={{ color: 'var(--color-yellow)' }}>
                  {averages[stat as keyof SeasonAverages]}
                </span>
                <span className="text-[10px]" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
                  {STATS.find((s) => s.value === stat)?.label?.toLowerCase() ?? stat} per game
                </span>
              </div>
            )}

            {/* Live stats hint */}
            {gameLive && liveStats && (
              <div
                className="flex items-center gap-3 px-3 py-2.5 rounded-[4px]"
                style={{ background: 'rgba(93,232,138,0.04)', border: '1px dashed rgba(93,232,138,0.15)' }}
              >
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--color-green)' }} />
                  <span className="text-[9px] uppercase tracking-wider chalk-header" style={{ color: 'var(--color-green)' }}>LIVE</span>
                </span>
                {STATS.map((s) => {
                  const val = liveStats[s.value];
                  if (val == null) return null;
                  const isSelected = s.value === stat;
                  return (
                    <div key={s.value} className="flex flex-col items-center" style={{ minWidth: 32 }}>
                      <span className="text-sm tabular-nums font-bold" style={{ color: isSelected ? 'var(--chalk-white)' : 'var(--chalk-dim)', lineHeight: 1 }}>
                        {val}
                      </span>
                      <span className="text-[8px] uppercase tracking-wider mt-0.5" style={{ color: isSelected ? 'var(--color-green)' : 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
                        {s.abbr}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

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
                  className="input-field"
                />
              </Field>
              <Field label="Odds">
                <div className="flex items-center gap-0 rounded-[4px] overflow-hidden" style={{ border: '1px dashed var(--dust-medium)', background: 'var(--dust-light)' }}>
                  {/* Mode toggle */}
                  <button
                    type="button"
                    onClick={() => {
                      if (oddsMode === 'american') {
                        // Convert current american to percent
                        const pct = isValidOdds ? Math.round(100 / (1 + multiplier)) : 50;
                        setOddsMode('percent');
                        setOddsInput(String(pct));
                      } else {
                        // Convert current percent to american
                        const am = isValidOdds
                          ? multiplier >= 1 ? Math.round(multiplier * 100) * -1 : Math.round(100 / multiplier)
                          : -110;
                        setOddsMode('american');
                        setOddsInput(String(am));
                      }
                    }}
                    className="flex-shrink-0 px-2 py-2 text-[9px] chalk-header tracking-wider cursor-pointer transition-all"
                    style={{ color: 'var(--color-yellow)', background: 'rgba(245,217,96,0.06)' }}
                    title={`Switch to ${oddsMode === 'american' ? 'percentage' : 'American'}`}
                  >
                    {oddsMode === 'american' ? 'US' : '%'}
                  </button>
                  <input
                    type="number"
                    value={oddsInput}
                    onChange={(e) => setOddsInput(e.target.value)}
                    placeholder={oddsMode === 'american' ? '-110' : '50'}
                    className="flex-1 min-w-0 px-2 py-2 bg-transparent text-sm outline-none"
                    style={{ color: 'var(--chalk-white)', fontFamily: 'var(--font-chalk-body)', border: 'none' }}
                  />
                </div>
                {isValidOdds && (
                  <div className="text-[9px] mt-1 tabular-nums" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
                    {oddsMode === 'american' ? `${percentDisplay}% implied` : `${formatAmerican(americanDisplay)} american`}
                  </div>
                )}
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
                        <span className={`text-xs font-bold tabular-nums`} style={{ color: americanDisplay > 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                          {formatAmerican(americanDisplay)}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-xs" style={{ color: 'var(--chalk-ghost)' }}>
                          Risk <span className="font-bold tabular-nums" style={{ color: 'var(--color-yellow)' }}>{stakeNum}</span>
                          {price !== null && <span className="opacity-50 ml-0.5">({formatUsd(stakeNum, price)})</span>}
                          {' '}&rarr; Win <span className="font-bold tabular-nums" style={{ color: 'var(--color-green)' }}>{takerStake}</span>
                          {price !== null && <span className="opacity-50 ml-0.5">({formatUsd(takerStake, price)})</span>}
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
                      Total Pool: <span className="tabular-nums" style={{ color: 'var(--color-yellow)' }}>{payout}</span>
                      {price !== null && <span className="opacity-50 ml-1">({formatUsd(payout, price)})</span>}
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
