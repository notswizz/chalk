'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { BetCard, Bet } from '@/components/betting/BetCard';
import { TournamentPropCard } from '@/components/betting/TournamentPropCard';
import { CreateTournamentProp } from '@/components/betting/CreateTournamentProp';
import { useUser } from '@/hooks/useUser';
import { TournamentProp } from '@/lib/types';

export const dynamic = 'force-dynamic';

const TABS = [
  { key: 'open' as const, label: 'On the Board', color: 'var(--color-green)', bg: 'rgba(93,232,138,0.1)' },
  { key: 'live' as const, label: 'Live Chalk', color: 'var(--color-yellow)', bg: 'rgba(245,217,96,0.1)' },
  { key: 'settled' as const, label: 'Final', color: 'var(--chalk-dim)', bg: 'rgba(232,228,217,0.08)' },
];

const SPORT_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'nba', label: 'NBA' },
  { key: 'ncaam', label: 'NCAA' },
  { key: 'tournament', label: '🏆 Tournament' },
];

export default function BetsPage() {
  const { userId, authenticated } = useUser();
  const [tab, setTab] = useState<'open' | 'live' | 'settled'>('open');
  const [mineOnly, setMineOnly] = useState(false);
  const [bets, setBets] = useState<Bet[]>([]);
  const [tournamentProps, setTournamentProps] = useState<TournamentProp[]>([]);
  const [gameStates, setGameStates] = useState<Record<string, string>>({});
  const [gameSports, setGameSports] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const autoSettledGames = useRef<Set<string>>(new Set());
  const [sportFilter, setSportFilter] = useState<string>('all');
  const [showCreateTournament, setShowCreateTournament] = useState(false);
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [playerFilter, setPlayerFilter] = useState<string>('all');
  const [teamSearch, setTeamSearch] = useState('');
  const [statFilter, setStatFilter] = useState<string>('all');
  const [potRange, setPotRange] = useState<[number, number]>([0, Infinity]);
  const [stakeRange, setStakeRange] = useState<[number, number]>([0, Infinity]);
  const [oddsRange, setOddsRange] = useState<[number, number]>([-Infinity, Infinity]);

  const fetchBets = useCallback(async () => {
    setLoading(true);
    try {
      const status = tab === 'open' ? 'open' : tab === 'live' ? 'matched' : 'settled_all';
      const res = await fetch(`/api/bets/all?status=${status}`);
      const data = await res.json();
      // Filter out tournament props from regular bets — they're fetched separately
      const loadedBets: Bet[] = (data.bets ?? []).filter((b: any) => b.type !== 'tournament');

      if (loadedBets.length > 0) {
        const gameIds = [...new Set(loadedBets.map((b) => b.gameId))];
        try {
          const gamesRes = await fetch(`/api/scores?ids=${gameIds.join(',')}`);
          const gamesData = await gamesRes.json();
          const states: Record<string, string> = {};
          const sports: Record<string, string> = {};
          const gameTeams: Record<string, { away: string; home: string; awayLogo: string; homeLogo: string }> = {};
          for (const g of gamesData.games ?? []) {
            states[g.id] = g.state;
            if (g.sport) sports[g.id] = g.sport;
            if (g.awayTeam && g.homeTeam) {
              gameTeams[g.id] = {
                away: g.awayTeam.abbreviation || '',
                home: g.homeTeam.abbreviation || '',
                awayLogo: g.awayTeam.logo || '',
                homeLogo: g.homeTeam.logo || '',
              };
            }
          }
          setGameStates(states);
          setGameSports(sports);

          // Enrich bets with team data from game data
          for (const b of loadedBets) {
            const t = gameTeams[b.gameId];
            if (t) {
              if (!b.awayTeam) b.awayTeam = t.away;
              if (!b.homeTeam) b.homeTeam = t.home;
              if (!b.awayTeamLogo) b.awayTeamLogo = t.awayLogo;
              if (!b.homeTeamLogo) b.homeTeamLogo = t.homeLogo;
            }
          }

          // Auto-settle/cancel bets for games that have ended
          for (const g of gamesData.games ?? []) {
            if (g.state === 'post' && !autoSettledGames.current.has(g.id)) {
              autoSettledGames.current.add(g.id);
              fetch('/api/bets/auto-settle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ gameId: g.id }),
              }).then(() => { if (tab === 'open') fetchBets(); }).catch(() => {});
            }
          }

          if (tab === 'open') {
            // Hide open bets for games that already ended
            setBets(loadedBets.filter((b) => {
              const state = states[b.gameId];
              return state !== 'post';
            }));
          } else if (tab === 'live') {
            // Live tab: show matched bets for active/upcoming games
            setBets(loadedBets.filter((b) => {
              const state = states[b.gameId];
              return state === 'in' || state === 'pre';
            }));
          } else {
            // Settled tab: show all
            setBets(loadedBets);
          }
        } catch {
          setBets(loadedBets);
        }
      } else {
        setBets(loadedBets);
      }
      // Fetch tournament props
      try {
        const tStatus = tab === 'open' ? 'open' : tab === 'live' ? 'matched' : 'settled_all';
        const tRes = await fetch(`/api/bets/all?status=${tStatus}&type=tournament`);
        const tData = await tRes.json();
        setTournamentProps(tData.bets ?? []);
      } catch { setTournamentProps([]); }

    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { fetchBets(); }, [fetchBets]);

  const showTournamentSection = sportFilter === 'all' || sportFilter === 'tournament';

  const filteredBets = bets
    .filter((b) => {
      if (tab === 'settled') {
        // Final tab: show all, or filter to mine
        if (mineOnly) return userId && (b.creatorId === userId || b.takerId === userId);
        return true;
      }
      if (mineOnly) return userId && (b.creatorId === userId || b.takerId === userId);
      // When not mine-only, exclude user's own bets
      return !userId || (b.creatorId !== userId && b.takerId !== userId);
    })
    .filter((b) => {
      if (sportFilter === 'all') return true;
      if (sportFilter === 'tournament') return false;
      const betSport = gameSports[b.gameId] || (b as any).sport || 'nba';
      return betSport === sportFilter;
    })
    .filter((b) => {
      if (teamFilter === 'all') return true;
      return b.awayTeam === teamFilter || b.homeTeam === teamFilter;
    })
    .filter((b) => {
      if (playerFilter === 'all') return true;
      return b.player === playerFilter;
    })
    .filter((b) => statFilter === 'all' || b.stat === statFilter)
    .filter((b) => {
      const pot = b.creatorStake + b.takerStake;
      return pot >= potRange[0] && pot <= potRange[1];
    })
    .filter((b) => {
      const stake = Math.min(b.creatorStake, b.takerStake);
      return stake >= stakeRange[0] && stake <= stakeRange[1];
    })
    .filter((b) => {
      const decimal = b.creatorStake / b.takerStake;
      const american = decimal >= 1 ? decimal * 100 : -(100 / decimal);
      return american >= oddsRange[0] && american <= oddsRange[1];
    });

  const showRegularSection = filteredBets.length > 0;

  const hasNonSportFilters = teamFilter !== 'all' || playerFilter !== 'all' || statFilter !== 'all' || potRange[0] > 0 || potRange[1] < Infinity || stakeRange[0] > 0 || stakeRange[1] < Infinity || oddsRange[0] > -Infinity || oddsRange[1] < Infinity;

  const filteredTournamentProps = showTournamentSection && !hasNonSportFilters
    ? tournamentProps
        .filter((p) => {
          if (mineOnly) return userId && (p.creatorId === userId || p.takerId === userId);
          return !userId || (p.creatorId !== userId && p.takerId !== userId);
        })
    : [];

  const totalFiltered = filteredBets.length + filteredTournamentProps.length;

  const activeTab = TABS.find((t) => t.key === tab)!;

  // Derive search results: players with headshots + teams with logos
  const playerMap = new Map<string, { playerId?: string; sport?: string; team?: string }>();
  const teamMap = new Map<string, string>();
  for (const b of bets) {
    if (b.player) playerMap.set(b.player, { playerId: b.playerId, sport: (b as any).sport, team: b.playerTeam });
    if (b.awayTeam && b.awayTeamLogo) teamMap.set(b.awayTeam, b.awayTeamLogo);
    if (b.homeTeam && b.homeTeamLogo) teamMap.set(b.homeTeam, b.homeTeamLogo);
  }
  const searchLower = teamSearch.toLowerCase();
  const searchResults = teamSearch.length >= 1 ? [
    ...[...playerMap.entries()]
      .filter(([name]) => name.toLowerCase().includes(searchLower))
      .map(([name, info]) => ({ type: 'player' as const, name, ...info })),
    ...[...teamMap.entries()]
      .filter(([name]) => name.toLowerCase().includes(searchLower))
      .map(([name, logo]) => ({ type: 'team' as const, name, logo })),
  ] : [];

  // Stat options
  const STAT_OPTIONS = ['points', 'rebounds', 'assists', 'threes'];
  const STAT_LABELS: Record<string, string> = { points: 'Points', rebounds: 'Rebounds', assists: 'Assists', threes: '3PM' };

  function getHeadshotUrl(playerId?: string, sport?: string) {
    if (!playerId) return null;
    const league = sport === 'ncaam' ? 'mens-college-basketball' : 'nba';
    return `https://a.espncdn.com/combiner/i?img=/i/headshots/${league}/players/full/${playerId}.png&w=96&h=70`;
  }

  const hasActiveFilters = teamFilter !== 'all' || playerFilter !== 'all' || statFilter !== 'all' || potRange[0] > 0 || potRange[1] < Infinity || stakeRange[0] > 0 || stakeRange[1] < Infinity || oddsRange[0] > -Infinity || oddsRange[1] < Infinity;

  function clearAllFilters() {
    setTeamFilter('all'); setPlayerFilter('all'); setStatFilter('all');
    setPotRange([0, Infinity]); setStakeRange([0, Infinity]); setOddsRange([-Infinity, Infinity]);
    setTeamSearch('');
  }

  return (
    <div className="max-w-6xl mx-auto px-4 pt-8">
      {/* ─── Header ─── */}
      <div className="flex flex-col items-center gap-3 mb-6 relative">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold" style={{ color: 'var(--chalk-white)', fontFamily: 'var(--font-chalk-header)' }}>The Board</h1>
          {!loading && totalFiltered > 0 && (
            <span className="px-2 py-0.5 rounded-[4px] text-[10px] font-bold tabular-nums" style={{ background: activeTab.bg, color: activeTab.color }}>
              {totalFiltered}
            </span>
          )}
        </div>

        {/* Tournament prop — top right */}
        {authenticated && (
          <div
            className="absolute right-0 top-0 rounded-[6px] p-[1.5px] transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] cursor-pointer"
            style={{ background: 'linear-gradient(135deg, #e85d5d, #f5d960, #5de88a, #5db8e8, #b05de8, #e85d5d)' }}
            onClick={() => setShowCreateTournament(true)}
          >
            <div
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-[5px] text-[11px] chalk-header tracking-wide"
              style={{ background: 'var(--board-dark)', color: 'var(--color-yellow)' }}
            >
              🏆 Tournament Prop
            </div>
          </div>
        )}

        {/* Tab switcher */}
        <div
          className="flex items-center gap-1 p-1 rounded-[6px]"
          style={{ background: 'rgba(232,228,217,0.06)', border: '1px dashed var(--dust-medium)' }}
        >
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => { setTab(t.key as typeof tab); if (t.key === 'live') setMineOnly(true); }}
                className="px-4 py-2 rounded-[5px] text-xs tracking-wide transition-all duration-200 cursor-pointer"
                style={{
                  fontFamily: 'var(--font-chalk-header)',
                  background: active ? t.bg : 'transparent',
                  color: active ? t.color : 'var(--chalk-ghost)',
                  border: active ? `1px dashed ${t.color}40` : '1px dashed transparent',
                  fontWeight: active ? 800 : 600,
                }}
              >
                {t.key === 'live' && active && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 animate-pulse" style={{ background: t.color }} />
                )}
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Main layout: board + sidebar ─── */}
      <div className="flex gap-4">
        {/* Board content */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="shimmer rounded-[4px] h-[200px]" />
              ))}
            </div>
          ) : totalFiltered === 0 ? (
            <EmptyState tab={tab} mineOnly={mineOnly} />
          ) : sportFilter === 'all' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 fade-up">
              {[
                ...filteredBets.map((b) => ({ kind: 'bet' as const, item: b, createdAt: b.createdAt })),
                ...filteredTournamentProps.map((p) => ({ kind: 'tournament' as const, item: p, createdAt: p.createdAt })),
              ]
                .sort((a, b) => b.createdAt - a.createdAt)
                .map((entry) =>
                  entry.kind === 'bet' ? (
                    <BetCard
                      key={entry.item.id}
                      bet={entry.item}
                      onUpdate={fetchBets}
                      showGame
                      gameOver={gameStates[entry.item.gameId] === 'post' || !gameStates[entry.item.gameId]}
                    />
                  ) : (
                    <TournamentPropCard key={entry.item.id} prop={entry.item} onUpdate={fetchBets} />
                  )
                )}
            </div>
          ) : sportFilter === 'tournament' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 fade-up">
              {filteredTournamentProps.map((prop) => (
                <TournamentPropCard key={prop.id} prop={prop} onUpdate={fetchBets} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 fade-up">
              {filteredBets.map((bet) => (
                <BetCard
                  key={bet.id}
                  bet={bet}
                  onUpdate={fetchBets}
                  showGame
                  gameOver={gameStates[bet.gameId] === 'post' || !gameStates[bet.gameId]}
                />
              ))}
            </div>
          )}
        </div>

        {/* ─── Right Sidebar ─── */}
        <div className="hidden md:block w-64 flex-shrink-0">
          <div className="sticky top-20 space-y-5">
            {/* Sport filters */}
            <div>
              <div className="text-[11px] uppercase tracking-widest mb-2 chalk-header" style={{ color: 'var(--chalk-ghost)' }}>Sport</div>
              <div className="flex flex-wrap gap-1.5">
                {SPORT_FILTERS.map((sf) => (
                  <button
                    key={sf.key}
                    onClick={() => setSportFilter(sf.key)}
                    className="px-3 py-1.5 rounded-[4px] text-xs font-bold transition-all duration-200 cursor-pointer"
                    style={{
                      background: sportFilter === sf.key ? 'rgba(245,217,96,0.12)' : 'transparent',
                      border: `1px dashed ${sportFilter === sf.key ? 'rgba(245,217,96,0.35)' : 'var(--dust-medium)'}`,
                      color: sportFilter === sf.key ? 'var(--color-yellow)' : 'var(--chalk-ghost)',
                    }}
                  >
                    {sf.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Mine toggle */}
            {authenticated && (
              <button
                onClick={() => setMineOnly((v) => !v)}
                className="w-full px-4 py-2.5 rounded-[5px] text-sm tracking-wide transition-all duration-200 cursor-pointer"
                style={{
                  fontFamily: 'var(--font-chalk-header)',
                  background: mineOnly ? 'rgba(93,155,232,0.12)' : 'transparent',
                  border: mineOnly ? '1px dashed rgba(93,155,232,0.4)' : '1px dashed var(--dust-medium)',
                  color: mineOnly ? 'var(--color-blue)' : 'var(--chalk-ghost)',
                  fontWeight: mineOnly ? 800 : 600,
                }}
              >
                My Props
              </button>
            )}

            {/* Clear all */}
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="w-full px-4 py-2 rounded-[5px] text-xs chalk-header tracking-wide cursor-pointer transition-all"
                style={{ border: '1px dashed rgba(232,93,93,0.3)', color: 'var(--color-red)' }}
              >
                Clear All Filters
              </button>
            )}

            {/* Search bar */}
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 z-10" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--chalk-ghost)" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                value={teamSearch}
                onChange={(e) => setTeamSearch(e.target.value)}
                placeholder="Search teams or players..."
                className="w-full pl-9 pr-3 py-2.5 rounded-[5px] text-sm outline-none"
                style={{
                  background: 'rgba(232,228,217,0.04)',
                  border: '1px dashed var(--dust-medium)',
                  color: 'var(--chalk-white)',
                  fontFamily: 'var(--font-chalk-body)',
                }}
              />
              {/* Search dropdown */}
              {searchResults.length > 0 && (
                <div
                  className="absolute top-full left-0 right-0 mt-1 rounded-[5px] overflow-hidden z-20 max-h-64 overflow-y-auto scrollbar-hide"
                  style={{ background: 'var(--board-dark)', border: '1px dashed var(--dust-medium)' }}
                >
                  {searchResults.map((r) => (
                    <button
                      key={`${r.type}-${r.name}`}
                      onClick={() => {
                        if (r.type === 'player') { setPlayerFilter(r.name); setTeamFilter('all'); }
                        else { setTeamFilter(r.name); setPlayerFilter('all'); }
                        setTeamSearch('');
                      }}
                      className="w-full text-left px-3 py-2 text-sm font-bold transition-all cursor-pointer flex items-center gap-2.5 hover:opacity-80"
                      style={{ color: 'var(--chalk-white)', borderBottom: '1px dashed rgba(232,228,217,0.06)' }}
                    >
                      {r.type === 'player' ? (
                        <>
                          {(() => {
                            const url = getHeadshotUrl(r.playerId, r.sport);
                            return url ? (
                              <img src={url} alt={r.name} className="w-8 h-6 object-cover rounded-[3px]" style={{ background: 'rgba(232,228,217,0.06)' }} />
                            ) : (
                              <div className="w-8 h-6 rounded-[3px] flex items-center justify-center" style={{ background: 'rgba(232,228,217,0.06)' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--chalk-ghost)" strokeWidth="2">
                                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
                                </svg>
                              </div>
                            );
                          })()}
                          <div>
                            <div>{r.name}</div>
                            {r.team && <div className="text-[10px]" style={{ color: 'var(--chalk-ghost)' }}>{r.team}</div>}
                          </div>
                        </>
                      ) : (
                        <>
                          <img src={(r as any).logo} alt={r.name} className="w-6 h-6 object-contain" />
                          {r.name}
                        </>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Active filter chip */}
            {(teamFilter !== 'all' || playerFilter !== 'all') && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-[5px] text-xs font-bold" style={{ background: 'rgba(245,217,96,0.08)', border: '1px dashed rgba(245,217,96,0.2)', color: 'var(--color-yellow)' }}>
                <span className="truncate">{teamFilter !== 'all' ? teamFilter : playerFilter}</span>
                <button
                  onClick={() => { setTeamFilter('all'); setPlayerFilter('all'); }}
                  className="ml-auto flex-shrink-0 cursor-pointer"
                  style={{ color: 'var(--chalk-ghost)' }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
              </div>
            )}

            {/* Stat filter */}
            <div>
              <div className="text-[11px] uppercase tracking-widest mb-2 chalk-header" style={{ color: 'var(--chalk-ghost)' }}>Stat</div>
              <div className="flex flex-wrap gap-1.5">
                {STAT_OPTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatFilter(statFilter === s ? 'all' : s)}
                    className="px-3 py-1.5 rounded-[4px] text-xs font-bold transition-all cursor-pointer"
                    style={{
                      background: statFilter === s ? 'rgba(245,217,96,0.12)' : 'transparent',
                      border: `1px dashed ${statFilter === s ? 'rgba(245,217,96,0.35)' : 'var(--dust-medium)'}`,
                      color: statFilter === s ? 'var(--color-yellow)' : 'var(--chalk-ghost)',
                    }}
                  >
                    {STAT_LABELS[s] || s}
                  </button>
                ))}
              </div>
            </div>

            {/* Range filters */}
            <div className="space-y-4">
              {/* Pot range */}
              <div>
                <div className="text-[11px] uppercase tracking-widest mb-1.5 chalk-header" style={{ color: 'var(--chalk-ghost)' }}>Pot Size</div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    placeholder="Min"
                    value={potRange[0] || ''}
                    onChange={(e) => setPotRange([Number(e.target.value) || 0, potRange[1]])}
                    className="w-full px-3 py-2 rounded-[4px] text-xs outline-none tabular-nums"
                    style={{ background: 'rgba(232,228,217,0.04)', border: '1px dashed var(--dust-medium)', color: 'var(--chalk-white)', fontFamily: 'var(--font-chalk-body)' }}
                  />
                  <span className="text-xs" style={{ color: 'var(--chalk-ghost)' }}>–</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={potRange[1] === Infinity ? '' : potRange[1]}
                    onChange={(e) => setPotRange([potRange[0], Number(e.target.value) || Infinity])}
                    className="w-full px-3 py-2 rounded-[4px] text-xs outline-none tabular-nums"
                    style={{ background: 'rgba(232,228,217,0.04)', border: '1px dashed var(--dust-medium)', color: 'var(--chalk-white)', fontFamily: 'var(--font-chalk-body)' }}
                  />
                </div>
              </div>

              {/* Stake range */}
              <div>
                <div className="text-[11px] uppercase tracking-widest mb-1.5 chalk-header" style={{ color: 'var(--chalk-ghost)' }}>Stake</div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    placeholder="Min"
                    value={stakeRange[0] || ''}
                    onChange={(e) => setStakeRange([Number(e.target.value) || 0, stakeRange[1]])}
                    className="w-full px-3 py-2 rounded-[4px] text-xs outline-none tabular-nums"
                    style={{ background: 'rgba(232,228,217,0.04)', border: '1px dashed var(--dust-medium)', color: 'var(--chalk-white)', fontFamily: 'var(--font-chalk-body)' }}
                  />
                  <span className="text-xs" style={{ color: 'var(--chalk-ghost)' }}>–</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={stakeRange[1] === Infinity ? '' : stakeRange[1]}
                    onChange={(e) => setStakeRange([stakeRange[0], Number(e.target.value) || Infinity])}
                    className="w-full px-3 py-2 rounded-[4px] text-xs outline-none tabular-nums"
                    style={{ background: 'rgba(232,228,217,0.04)', border: '1px dashed var(--dust-medium)', color: 'var(--chalk-white)', fontFamily: 'var(--font-chalk-body)' }}
                  />
                </div>
              </div>

              {/* Odds range */}
              <div>
                <div className="text-[11px] uppercase tracking-widest mb-1.5 chalk-header" style={{ color: 'var(--chalk-ghost)' }}>Odds</div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    placeholder="−500"
                    value={oddsRange[0] === -Infinity ? '' : oddsRange[0]}
                    onChange={(e) => setOddsRange([Number(e.target.value) || -Infinity, oddsRange[1]])}
                    className="w-full px-3 py-2 rounded-[4px] text-xs outline-none tabular-nums"
                    style={{ background: 'rgba(232,228,217,0.04)', border: '1px dashed var(--dust-medium)', color: 'var(--chalk-white)', fontFamily: 'var(--font-chalk-body)' }}
                  />
                  <span className="text-xs" style={{ color: 'var(--chalk-ghost)' }}>–</span>
                  <input
                    type="number"
                    placeholder="+500"
                    value={oddsRange[1] === Infinity ? '' : oddsRange[1]}
                    onChange={(e) => setOddsRange([oddsRange[0], Number(e.target.value) || Infinity])}
                    className="w-full px-3 py-2 rounded-[4px] text-xs outline-none tabular-nums"
                    style={{ background: 'rgba(232,228,217,0.04)', border: '1px dashed var(--dust-medium)', color: 'var(--chalk-white)', fontFamily: 'var(--font-chalk-body)' }}
                  />
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Create Tournament Prop modal */}
      {showCreateTournament && (
        <CreateTournamentProp
          onClose={() => setShowCreateTournament(false)}
          onCreated={() => { setShowCreateTournament(false); fetchBets(); }}
        />
      )}
    </div>
  );
}

function EmptyState({ tab, mineOnly }: { tab: string; mineOnly?: boolean }) {
  const config: Record<string, { icon: React.ReactNode; title: string; subtitle: string }> = {
    open: {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--chalk-ghost)' }}>
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      ),
      title: 'Board is clean',
      subtitle: 'Draw up a prop from any game page',
    },
    live: {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--chalk-ghost)' }}>
          <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
        </svg>
      ),
      title: 'No live chalk',
      subtitle: 'Matched props appear here during games',
    },
  };

  const c = config[tab] || config.open;

  return (
    <div
      className="flex flex-col items-center justify-center py-20 rounded-[4px] fade-up"
      style={{ background: 'var(--dust-light)', border: '1px dashed var(--dust-light)' }}
    >
      <div
        className="w-12 h-12 rounded-[4px] flex items-center justify-center mb-4"
        style={{ background: 'var(--dust-light)' }}
      >
        {c.icon}
      </div>
      <p className="text-sm font-semibold" style={{ color: 'var(--chalk-dim)' }}>{mineOnly ? 'No props here' : c.title}</p>
      <p className="text-xs mt-1" style={{ color: 'var(--chalk-ghost)' }}>{mineOnly ? 'You have no props in this tab' : c.subtitle}</p>
    </div>
  );
}
