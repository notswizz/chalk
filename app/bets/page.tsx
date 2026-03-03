'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { BetCard, Bet } from '@/components/betting/BetCard';
import { useUser } from '@/hooks/useUser';

const TABS = [
  { key: 'open' as const, label: 'On the Board', color: 'var(--color-green)', bg: 'rgba(93,232,138,0.1)' },
  { key: 'live' as const, label: 'Live Chalk', color: 'var(--color-yellow)', bg: 'rgba(245,217,96,0.1)' },
  { key: 'validate' as const, label: 'Score Check', color: 'var(--color-orange)', bg: 'rgba(232,168,93,0.1)' },
];

export default function BetsPage() {
  const { userId, authenticated } = useUser();
  const [tab, setTab] = useState<'open' | 'live' | 'validate'>('open');
  const [mineOnly, setMineOnly] = useState(false);
  const [bets, setBets] = useState<Bet[]>([]);
  const [gameStates, setGameStates] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const autoSettledGames = useRef<Set<string>>(new Set());

  const fetchBets = useCallback(async () => {
    setLoading(true);
    try {
      const status = tab === 'open' ? 'open' : 'matched';
      const res = await fetch(`/api/bets/all?status=${status}`);
      const data = await res.json();
      const loadedBets: Bet[] = data.bets ?? [];

      if (loadedBets.length > 0) {
        const gameIds = [...new Set(loadedBets.map((b) => b.gameId))];
        try {
          const gamesRes = await fetch(`/api/scores?ids=${gameIds.join(',')}`);
          const gamesData = await gamesRes.json();
          const states: Record<string, string> = {};
          for (const g of gamesData.games ?? []) {
            states[g.id] = g.state;
          }
          setGameStates(states);

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
            setBets(loadedBets.filter((b) => {
              const state = states[b.gameId];
              return state === 'in' || state === 'pre';
            }));
          } else {
            setBets(loadedBets.filter((b) => {
              const state = states[b.gameId];
              return state === 'post' || !state;
            }));
          }
        } catch {
          setBets(loadedBets);
        }
      } else {
        setBets(loadedBets);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { fetchBets(); }, [fetchBets]);

  const filteredBets = mineOnly && userId
    ? bets.filter((b) => b.creatorId === userId || b.takerId === userId)
    : bets;

  const activeTab = TABS.find((t) => t.key === tab)!;

  return (
    <div className="pinned-header-layout max-w-2xl mx-auto px-4">
      {/* ─── Pinned Header ─── */}
      <div className="pinned-header pt-8 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold" style={{ color: 'var(--chalk-white)', fontFamily: 'var(--font-chalk-header)' }}>The Board</h1>
            {!loading && filteredBets.length > 0 && (
              <span className="px-2 py-0.5 rounded-[4px] text-[10px] font-bold tabular-nums" style={{ background: activeTab.bg, color: activeTab.color }}>
                {filteredBets.length}
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
                onClick={() => setTab(t.key)}
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
      </div>

      {/* ─── Scrollable Content ─── */}
      <div className="pinned-scroll scrollbar-hide">
        {loading ? (
          <div className="space-y-2.5">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="shimmer rounded-[4px] h-[120px]" />
            ))}
          </div>
        ) : filteredBets.length === 0 ? (
          <EmptyState tab={tab} mineOnly={mineOnly} />
        ) : (
          <div className="space-y-2.5 fade-up">
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
    validate: {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--chalk-ghost)' }}>
          <path d="M20 6L9 17l-5-5" />
        </svg>
      ),
      title: 'Nothing to check',
      subtitle: 'Props move here after the buzzer',
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
