'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@/hooks/useUser';
import { BetCard, Bet } from './BetCard';
import { CreateBetModal } from './CreateBetModal';

export function BetFeed({ gameId, gameTitle, gameOver, teams, teamIds, teamLogos, sport }: { gameId: string; gameTitle: string; gameOver?: boolean; teams?: string[]; teamIds?: string[]; teamLogos?: string[]; sport?: string }) {
  const { authenticated, login, getAccessToken, refreshProfile } = useUser();
  const [tab, setTab] = useState<'open' | 'mine'>('open');
  const [bets, setBets] = useState<Bet[]>([]);
  const [myBets, setMyBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const fetchBets = useCallback(async () => {
    try {
      const res = await fetch(`/api/bets/${gameId}`);
      const data = await res.json();
      setBets(data.bets ?? []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [gameId]);

  const fetchMyBets = useCallback(async () => {
    if (!authenticated) return;
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/bets/mine', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const gameBets = (data.bets ?? []).filter((b: Bet) => b.gameId === gameId);
      setMyBets(gameBets);
    } catch { /* silent */ }
  }, [authenticated, getAccessToken, gameId]);

  useEffect(() => { fetchBets(); }, [fetchBets]);
  useEffect(() => { fetchMyBets(); }, [fetchMyBets]);

  function handleUpdate() {
    fetchBets();
    fetchMyBets();
    refreshProfile();
  }

  // Enrich bets with team data from game page props
  const enrichBet = (b: Bet): Bet => {
    if (b.awayTeamLogo && b.homeTeamLogo) return b;
    if (!teams || teams.length < 2) return b;
    return {
      ...b,
      awayTeam: b.awayTeam || teams[0],
      homeTeam: b.homeTeam || teams[1],
      awayTeamLogo: teamLogos?.[0] || b.awayTeamLogo,
      homeTeamLogo: teamLogos?.[1] || b.homeTeamLogo,
      sport: sport || b.sport,
    };
  };

  const displayBets = (tab === 'open' ? bets.filter((b) => b.status === 'open') : myBets).map(enrichBet);
  const openCount = bets.filter((b) => b.status === 'open').length;
  const matchedCount = bets.filter((b) => b.status === 'matched').length;

  return (
    <div className="mt-2">
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="section-label">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--chalk-ghost)' }}>
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
            The Board
          </div>
          {!loading && (openCount > 0 || matchedCount > 0) && (
            <div className="flex items-center gap-1.5">
              {openCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-[4px] text-[9px] font-bold tabular-nums" style={{ background: 'rgba(93,232,138,0.08)', color: 'var(--color-green)' }}>
                  {openCount} open
                </span>
              )}
              {matchedCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-[4px] text-[9px] font-bold tabular-nums" style={{ background: 'rgba(245,217,96,0.08)', color: 'var(--color-yellow)' }}>
                  {matchedCount} matched
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-0.5 p-0.5 rounded-[4px] w-full mb-3" style={{ background: 'var(--dust-light)', border: '1px dashed var(--dust-light)' }}>
        <button
          onClick={() => setTab('open')}
          className="flex-1 px-2 py-1.5 rounded-[4px] text-[11px] font-bold transition-all cursor-pointer"
          style={{
            background: tab === 'open' ? 'rgba(245,217,96,0.12)' : 'transparent',
            color: tab === 'open' ? 'var(--color-yellow)' : 'var(--chalk-ghost)',
          }}
        >
          Board
        </button>
        <button
          onClick={() => { if (!authenticated) { login(); return; } setTab('mine'); }}
          className="flex-1 px-2 py-1.5 rounded-[4px] text-[11px] font-bold transition-all cursor-pointer"
          style={{
            background: tab === 'mine' ? 'rgba(245,217,96,0.12)' : 'transparent',
            color: tab === 'mine' ? 'var(--color-yellow)' : 'var(--chalk-ghost)',
          }}
        >
          Mine
        </button>
      </div>

      {/* Draw up a prop */}
      <div
        className="relative rounded-[6px] p-[1.5px] transition-all duration-200 hover:scale-[1.02] active:scale-[0.97] cursor-pointer mb-3"
        style={{ background: 'linear-gradient(135deg, #e85d5d, #f5d960, #5de88a, #5db8e8, #b05de8, #e85d5d)' }}
        onClick={() => { if (!authenticated) { login(); return; } setShowCreate(true); }}
      >
        <div
          className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-[5px] text-xs chalk-header tracking-wide"
          style={{ background: 'var(--board-dark)', color: 'var(--color-yellow)' }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Draw up a prop
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-2.5">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="shimmer rounded-[4px] h-[120px]" />
          ))}
        </div>
      ) : displayBets.length === 0 ? (
        <div
          className="text-center py-12 rounded-[4px]"
          style={{ background: 'var(--dust-light)', border: '1px dashed var(--dust-light)' }}
        >
          <p className="text-xs font-medium" style={{ color: 'var(--chalk-ghost)' }}>
            {tab === 'open' ? 'Board is clean — draw up a prop' : 'No props for this game yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-2 overflow-y-auto" style={{ maxHeight: 380, scrollbarWidth: 'thin', scrollbarColor: 'var(--dust-medium) transparent' }}>
          {displayBets.map((bet) => (
            <BetCard key={bet.id} bet={bet as Bet} onUpdate={handleUpdate} gameOver={gameOver} />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateBetModal
          gameId={gameId}
          gameTitle={gameTitle}
          teams={teams}
          teamIds={teamIds}
          sport={sport}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            handleUpdate();
          }}
        />
      )}
    </div>
  );
}
