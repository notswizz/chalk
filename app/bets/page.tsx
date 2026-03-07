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
];

const SPORT_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'nba', label: 'NBA' },
  { key: 'ncaam', label: 'NCAA' },
  { key: 'tournament', label: '🏆 Tournament' },
];

export default function BetsPage() {
  const { userId, authenticated } = useUser();
  const [tab, setTab] = useState<'open' | 'live'>('open');
  const [mineOnly, setMineOnly] = useState(false);
  const [bets, setBets] = useState<Bet[]>([]);
  const [tournamentProps, setTournamentProps] = useState<TournamentProp[]>([]);
  const [gameStates, setGameStates] = useState<Record<string, string>>({});
  const [gameSports, setGameSports] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const autoSettledGames = useRef<Set<string>>(new Set());
  const [filterStat, setFilterStat] = useState<string>('all');
  const [filterGame, setFilterGame] = useState<string>('all');
  const [sportFilter, setSportFilter] = useState<string>('all');
  const [showCreateTournament, setShowCreateTournament] = useState(false);

  const fetchBets = useCallback(async () => {
    setLoading(true);
    try {
      const status = tab === 'open' ? 'open' : 'matched';
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
          } else {
            // Live tab: show matched bets for active/upcoming games
            setBets(loadedBets.filter((b) => {
              const state = states[b.gameId];
              return state === 'in' || state === 'pre';
            }));
          }
        } catch {
          setBets(loadedBets);
        }
      } else {
        setBets(loadedBets);
      }
      // Fetch tournament props
      try {
        const tStatus = tab === 'open' ? 'open' : 'matched';
        const tRes = await fetch(`/api/bets/all?status=${tStatus}&type=tournament`);
        const tData = await tRes.json();
        setTournamentProps(tData.bets ?? []);
      } catch { setTournamentProps([]); }

    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { fetchBets(); }, [fetchBets]);

  // Derive unique stats and games for filter dropdowns
  const statOptions = [...new Set(bets.map((b) => b.stat).filter(Boolean))].sort();
  const gameOptions = [...new Set(bets.filter((b) => b.gameTitle).map((b) => b.gameTitle!))].sort();

  const showTournamentSection = sportFilter === 'all' || sportFilter === 'tournament';

  const filteredBets = bets
    .filter((b) => {
      if (mineOnly) return userId && (b.creatorId === userId || b.takerId === userId);
      // When not mine-only, exclude user's own bets
      return !userId || (b.creatorId !== userId && b.takerId !== userId);
    })
    .filter((b) => filterStat === 'all' || b.stat === filterStat)
    .filter((b) => filterGame === 'all' || b.gameTitle === filterGame)
    .filter((b) => {
      if (sportFilter === 'all') return true;
      if (sportFilter === 'tournament') return false;
      // Use game's sport from scores data, fall back to bet's sport field, then default nba
      const betSport = gameSports[b.gameId] || (b as any).sport || 'nba';
      return betSport === sportFilter;
    });

  const showRegularSection = filteredBets.length > 0;

  const filteredTournamentProps = showTournamentSection
    ? tournamentProps
        .filter((p) => {
          if (mineOnly) return userId && (p.creatorId === userId || p.takerId === userId);
          return !userId || (p.creatorId !== userId && p.takerId !== userId);
        })
    : [];

  const totalFiltered = filteredBets.length + filteredTournamentProps.length;

  const activeTab = TABS.find((t) => t.key === tab)!;

  return (
    <div className="pinned-header-layout max-w-5xl mx-auto px-4">
      {/* ─── Pinned Header ─── */}
      <div className="pinned-header pt-8 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold" style={{ color: 'var(--chalk-white)', fontFamily: 'var(--font-chalk-header)' }}>The Board</h1>
            {!loading && totalFiltered > 0 && (
              <span className="px-2 py-0.5 rounded-[4px] text-[10px] font-bold tabular-nums" style={{ background: activeTab.bg, color: activeTab.color }}>
                {totalFiltered}
              </span>
            )}
            {authenticated && (
              <button
                onClick={() => setMineOnly((v) => !v)}
                className="px-2.5 py-1 rounded-[4px] text-[10px] font-bold transition-all duration-200 cursor-pointer"
                style={{
                  background: mineOnly ? 'rgba(245,217,96,0.12)' : 'transparent',
                  border: `1px dashed ${mineOnly ? 'rgba(245,217,96,0.35)' : 'var(--dust-medium)'}`,
                  color: mineOnly ? 'var(--color-yellow)' : 'var(--chalk-ghost)',
                }}
              >
                Mine
              </button>
            )}
          </div>

          {/* Tab switcher */}
          <div
            className="flex items-center gap-0.5 p-0.5 rounded-[4px]"
            style={{ background: 'var(--dust-light)', border: '1px dashed var(--dust-light)' }}
          >
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => { setTab(t.key); if (t.key === 'live') setMineOnly(true); }}
                className="px-3.5 py-1.5 rounded-[4px] text-[11px] font-bold transition-all duration-200 cursor-pointer"
                style={{
                  background: tab === t.key ? t.bg : 'transparent',
                  color: tab === t.key ? t.color : 'var(--chalk-ghost)',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sport filter tabs */}
        <div className="flex items-center gap-1.5 mt-3">
          {SPORT_FILTERS.map((sf) => (
            <button
              key={sf.key}
              onClick={() => setSportFilter(sf.key)}
              className="px-2.5 py-1 rounded-[4px] text-[10px] font-bold transition-all duration-200 cursor-pointer"
              style={{
                background: sportFilter === sf.key ? 'rgba(245,217,96,0.12)' : 'transparent',
                border: `1px dashed ${sportFilter === sf.key ? 'rgba(245,217,96,0.35)' : 'var(--dust-medium)'}`,
                color: sportFilter === sf.key ? 'var(--color-yellow)' : 'var(--chalk-ghost)',
              }}
            >
              {sf.label}
            </button>
          ))}
          {authenticated && (
            <div
              className="ml-auto relative rounded-[6px] p-[1.5px] transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] cursor-pointer"
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
        </div>

        {/* Filters */}
        {bets.length > 0 && (
          <div className="flex items-center gap-2 mt-3">
            {statOptions.length >= 1 && (
              <select
                value={filterStat}
                onChange={(e) => setFilterStat(e.target.value)}
                className="px-2.5 py-1.5 rounded-[4px] text-[11px] chalk-header cursor-pointer outline-none"
                style={{
                  background: filterStat !== 'all' ? 'rgba(245,217,96,0.12)' : 'var(--dust-light)',
                  border: `1px dashed ${filterStat !== 'all' ? 'rgba(245,217,96,0.35)' : 'var(--dust-medium)'}`,
                  color: filterStat !== 'all' ? 'var(--color-yellow)' : 'var(--chalk-ghost)',
                }}
              >
                <option value="all" style={{ background: 'var(--board-dark)' }}>All Stats</option>
                {statOptions.map((s) => (
                  <option key={s} value={s} style={{ background: 'var(--board-dark)' }}>
                    {{ points: 'Points', rebounds: 'Rebounds', assists: 'Assists', threes: '3-Pointers' }[s] || s}
                  </option>
                ))}
              </select>
            )}
            {gameOptions.length >= 1 && (
              <select
                value={filterGame}
                onChange={(e) => setFilterGame(e.target.value)}
                className="px-2.5 py-1.5 rounded-[4px] text-[11px] chalk-header cursor-pointer outline-none truncate max-w-[200px]"
                style={{
                  background: filterGame !== 'all' ? 'rgba(245,217,96,0.12)' : 'var(--dust-light)',
                  border: `1px dashed ${filterGame !== 'all' ? 'rgba(245,217,96,0.35)' : 'var(--dust-medium)'}`,
                  color: filterGame !== 'all' ? 'var(--color-yellow)' : 'var(--chalk-ghost)',
                }}
              >
                <option value="all" style={{ background: 'var(--board-dark)' }}>All Games</option>
                {gameOptions.map((g) => (
                  <option key={g} value={g} style={{ background: 'var(--board-dark)' }}>{g}</option>
                ))}
              </select>
            )}
            {(filterStat !== 'all' || filterGame !== 'all') && (
              <button
                onClick={() => { setFilterStat('all'); setFilterGame('all'); }}
                className="text-[10px] px-2 py-1 rounded-[4px] cursor-pointer transition-all"
                style={{ color: 'var(--chalk-ghost)', border: '1px dashed var(--dust-medium)' }}
              >
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* ─── Scrollable Content ─── */}
      <div className="pinned-scroll scrollbar-hide">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="shimmer rounded-[4px] h-[200px]" />
            ))}
          </div>
        ) : totalFiltered === 0 ? (
          <EmptyState tab={tab} mineOnly={mineOnly} />
        ) : sportFilter === 'all' ? (
          /* All filter: merge everything into one grid sorted by createdAt */
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
          /* Tournament only */
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 fade-up">
            {filteredTournamentProps.map((prop) => (
              <TournamentPropCard key={prop.id} prop={prop} onUpdate={fetchBets} />
            ))}
          </div>
        ) : (
          /* NBA or NCAA player props only */
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

        {/* Create Tournament Prop modal */}
        {showCreateTournament && (
          <CreateTournamentProp
            onClose={() => setShowCreateTournament(false)}
            onCreated={() => { setShowCreateTournament(false); fetchBets(); }}
          />
        )}
      </div>
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
