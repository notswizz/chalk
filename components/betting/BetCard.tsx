'use client';

import { useUser } from '@/hooks/useUser';
import { useChalkPrice, formatUsd } from '@/hooks/useChalkPrice';
import { useState, useEffect, useRef, useCallback } from 'react';
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
  playerId?: string;
  playerTeam?: string;
  awayTeam?: string;
  homeTeam?: string;
  awayTeamLogo?: string;
  homeTeamLogo?: string;
  sport?: string;
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

function getPlayerHeadshot(playerId?: string, sport?: string): string | null {
  if (!playerId) return null;
  const league = sport === 'ncaam' ? 'mens-college-basketball' : 'nba';
  return `https://a.espncdn.com/combiner/i?img=/i/headshots/${league}/players/full/${playerId}.png&w=96&h=70`;
}

function getTeamLogo(abbrev: string, sport?: string): string {
  const league = sport === 'ncaam' ? 'ncaa' : 'nba';
  return `https://a.espncdn.com/i/teamlogos/${league}/500/${abbrev.toLowerCase()}.png`;
}

const NBA_TEAM_ABBREVS: Record<string, string> = {
  'atlanta hawks': 'atl', 'boston celtics': 'bos', 'brooklyn nets': 'bkn',
  'charlotte hornets': 'cha', 'chicago bulls': 'chi', 'cleveland cavaliers': 'cle',
  'dallas mavericks': 'dal', 'denver nuggets': 'den', 'detroit pistons': 'det',
  'golden state warriors': 'gs', 'houston rockets': 'hou', 'indiana pacers': 'ind',
  'la clippers': 'lac', 'los angeles clippers': 'lac',
  'los angeles lakers': 'lal', 'la lakers': 'lal',
  'memphis grizzlies': 'mem', 'miami heat': 'mia', 'milwaukee bucks': 'mil',
  'minnesota timberwolves': 'min', 'new orleans pelicans': 'no',
  'new york knicks': 'ny', 'oklahoma city thunder': 'okc',
  'orlando magic': 'orl', 'philadelphia 76ers': 'phi', 'phoenix suns': 'phx',
  'portland trail blazers': 'por', 'sacramento kings': 'sac',
  'san antonio spurs': 'sa', 'toronto raptors': 'tor',
  'utah jazz': 'uta', 'washington wizards': 'wsh',
};

function getTeamsFromBet(bet: Bet): { awayLogo: string; homeLogo: string; awayAbbr: string; homeAbbr: string; playerTeam: string } | null {
  // Use stored logo URLs if available (set by enrichment from game data)
  if (bet.awayTeamLogo && bet.homeTeamLogo) {
    return { awayLogo: bet.awayTeamLogo, homeLogo: bet.homeTeamLogo, awayAbbr: bet.awayTeam || '', homeAbbr: bet.homeTeam || '', playerTeam: bet.playerTeam || '' };
  }
  // Fallback: construct from abbreviations (NBA only)
  if (bet.awayTeam && bet.homeTeam) {
    return {
      awayLogo: getTeamLogo(bet.awayTeam, bet.sport),
      homeLogo: getTeamLogo(bet.homeTeam, bet.sport),
      awayAbbr: bet.awayTeam, homeAbbr: bet.homeTeam,
      playerTeam: bet.playerTeam || '',
    };
  }
  // Last resort: parse gameTitle for old NBA bets
  if (!bet.gameTitle) return null;
  const parts = bet.gameTitle.split(/\s+vs\.?\s+/i);
  if (parts.length !== 2) return null;
  const awayAbbr = NBA_TEAM_ABBREVS[parts[0].trim().toLowerCase()];
  const homeAbbr = NBA_TEAM_ABBREVS[parts[1].trim().toLowerCase()];
  if (!awayAbbr || !homeAbbr) return null;
  return {
    awayLogo: getTeamLogo(awayAbbr, bet.sport),
    homeLogo: getTeamLogo(homeAbbr, bet.sport),
    awayAbbr, homeAbbr,
    playerTeam: bet.playerTeam || '',
  };
}

const STAT_LABELS: Record<string, string> = { points: 'PTS', rebounds: 'REB', assists: 'AST', threes: '3PM' };

export function toAmericanOdds(decimal: number) {
  if (decimal >= 1) return `+${Math.round(decimal * 100)}`;
  return `${Math.round(-100 / decimal)}`;
}

export function BetCard({ bet, onUpdate, showGame, gameOver, liveStats }: { bet: Bet; onUpdate: () => void; showGame?: boolean; gameOver?: boolean; liveStats?: Record<string, number> | null }) {
  const { authenticated, userId, getAccessToken, login } = useUser();
  const { price } = useChalkPrice();
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showChalkCard, setShowChalkCard] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [hasChat, setHasChat] = useState(false);

  const currentStat = liveStats?.[bet.stat];
  const isTracking = currentStat != null && (bet.status === 'matched' || bet.status === 'open');

  // Check if bet has chat messages (for notification dot)
  useEffect(() => {
    if (!bet.takerId || !authenticated) return;
    const checkChat = async () => {
      try {
        const token = await getAccessToken();
        const res = await fetch(`/api/bets/chat?betId=${bet.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.messages?.length > 0) setHasChat(true);
        }
      } catch { /* silent */ }
    };
    checkChat();
  }, [bet.id, bet.takerId, authenticated, getAccessToken]);

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

  const headshot = getPlayerHeadshot(bet.playerId, bet.sport);
  const teams = getTeamsFromBet(bet);

  // Determine live border color: green if hitting, red if losing
  const getLiveBorderStyle = (): React.CSSProperties => {
    if (!isTracking || !isParticipant) {
      if (isParticipant) return { border: '1.5px dashed rgba(245,217,96,0.35)', boxShadow: '0 0 16px rgba(245,217,96,0.06)' };
      return {};
    }
    // From the viewer's perspective
    const viewerDir = isCreator ? bet.direction : (bet.direction === 'over' ? 'under' : 'over');
    const isHitting = viewerDir === 'over' ? currentStat! >= bet.target : currentStat! < bet.target;
    if (isHitting) return { border: '1.5px solid rgba(93,232,138,0.5)', boxShadow: '0 0 16px rgba(93,232,138,0.12)' };
    return { border: '1.5px solid rgba(232,93,93,0.5)', boxShadow: '0 0 16px rgba(232,93,93,0.12)' };
  };

  return (
    <>
      <div
        className="chalk-card rounded-[6px] overflow-hidden transition-all duration-200 cursor-pointer flex flex-col"
        style={{
          opacity: isSettled || isCancelled ? 0.65 : 1,
          ...getLiveBorderStyle(),
        }}
        onClick={() => setShowModal(true)}
      >
        {/* Player info: headshot left, name + team logos right */}
        <div className="relative px-2.5 pt-2.5 pb-2" style={{ background: 'linear-gradient(135deg, rgba(232,228,217,0.04), rgba(232,228,217,0.01))' }}>
          {/* Status + YOUR BET badges */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <StatusBadge status={bet.status} gameOver={gameOver} isMatched={isMatched} />
              {hasChat && (
                <span className="flex items-center gap-0.5 text-[7px] chalk-header tracking-wider" style={{ color: 'var(--color-blue, #5db8e8)' }}>
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                  </svg>
                </span>
              )}
            </div>
            {isParticipant && (
              <span className="text-[7px] chalk-header tracking-[0.15em] px-1.5 py-0.5 rounded-[3px]" style={{ color: 'var(--color-yellow)', background: 'rgba(0,0,0,0.4)' }}>YOUR BET</span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {/* Headshot */}
            <div className="flex-shrink-0">
              {headshot ? (
                <div className="rounded-full p-[1.5px]" style={{ background: 'linear-gradient(135deg, rgba(232,228,217,0.25), rgba(232,228,217,0.08))' }}>
                  <img
                    src={headshot}
                    alt=""
                    width={56}
                    height={56}
                    className="rounded-full object-cover"
                    style={{ background: 'rgba(232,228,217,0.06)', width: 56, height: 56 }}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              ) : (
                <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'rgba(232,228,217,0.06)', border: '1.5px dashed rgba(232,228,217,0.15)' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--chalk-ghost)' }}>
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
              )}
            </div>

            {/* Name + Team logos */}
            <div className="flex-1 min-w-0">
              <div className="text-[14px] chalk-header truncate" style={{ color: 'var(--chalk-white)' }}>{bet.player}</div>
              {/* Team logos for game */}
              {teams ? (
                <div className="flex items-center gap-1.5 mt-1">
                  <img
                    src={teams.awayLogo}
                    alt={teams.awayAbbr}
                    className="flex-shrink-0 object-contain"
                    style={{ width: teams.playerTeam === teams.awayAbbr ? 22 : 16, height: teams.playerTeam === teams.awayAbbr ? 22 : 16, opacity: teams.playerTeam === teams.awayAbbr ? 1 : 0.5 }}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                  <span className="text-[8px]" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>vs</span>
                  <img
                    src={teams.homeLogo}
                    alt={teams.homeAbbr}
                    className="flex-shrink-0 object-contain"
                    style={{ width: teams.playerTeam === teams.homeAbbr ? 22 : 16, height: teams.playerTeam === teams.homeAbbr ? 22 : 16, opacity: teams.playerTeam === teams.homeAbbr ? 1 : 0.5 }}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              ) : showGame && bet.gameTitle ? (
                <div className="text-[9px] truncate mt-0.5" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>{bet.gameTitle}</div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Prop line */}
        <div className="px-2.5 py-2" style={{ borderTop: '1px dashed rgba(232,228,217,0.06)' }}>
          <div className="flex items-center justify-center gap-2">
            <span
              className="px-2 py-0.5 rounded-[3px] text-[10px] chalk-header tracking-wide"
              style={{ background: `${displayDirColor}12`, color: displayDirColor, border: `1px dashed ${displayDirColor}25` }}
            >
              {displayDir.toUpperCase()}
            </span>
            <span className="text-xl tabular-nums chalk-score" style={{ color: 'var(--chalk-white)' }}>{bet.target}</span>
            <span className="text-[11px] chalk-header" style={{ color: 'var(--chalk-dim)' }}>{statLabel}</span>
          </div>
          {isTracking && (
            <div className="flex items-center justify-center gap-1.5 mt-1.5">
              <span className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>Now:</span>
              <span
                className="text-sm tabular-nums chalk-score"
                style={{ color: currentStat >= bet.target ? 'var(--color-green)' : 'var(--color-yellow)' }}
              >
                {currentStat}
              </span>
              <span className="text-[9px]" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>{statLabel}</span>
            </div>
          )}
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
            <div className="text-base tabular-nums chalk-score" style={{ color: 'var(--chalk-white)' }}>{displayOdds}</div>
            <div className="text-[8px] uppercase tracking-wider" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>Odds</div>
          </div>
        </div>

        {/* Settled result */}
        {isSettled && bet.actualValue != null && (
          <div className="px-2.5 py-1.5 flex items-center justify-center gap-1.5 text-[10px]" style={{ borderTop: '1px dashed rgba(232,228,217,0.06)', fontFamily: 'var(--font-chalk-body)' }}>
            <span style={{ color: 'var(--chalk-ghost)' }}>Actual: {bet.actualValue} {statLabel}</span>
            <span className="chalk-header" style={{ color: bet.result === 'push' ? 'var(--chalk-dim)' : bet.result === 'creator_wins' ? 'var(--color-green)' : 'var(--color-red)' }}>
              {bet.result === 'push' ? 'Push' : bet.result === 'creator_wins' ? `${bet.creatorName} wins` : `${bet.takerName} wins`}
            </span>
          </div>
        )}

        {/* Footer */}
        <div className="px-2.5 py-2 flex items-center justify-between" style={{ borderTop: '1px dashed rgba(232,228,217,0.06)' }}>
          <span className="text-[9px] truncate" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
            {bet.creatorName}
          </span>
          <div className="flex items-center gap-1.5">
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
            {authenticated && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowChalkCard(true); }}
                className="chalk-btn px-1.5 py-1 rounded-[3px] cursor-pointer"
                style={{ background: 'rgba(245,217,96,0.08)', color: 'var(--color-yellow)' }}
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
          userId={userId}
          getAccessToken={getAccessToken}
        />,
        document.body
      )}

      {/* Chalk Card modal */}
      {showChalkCard && (
        <ChalkCardModal bet={bet} onClose={() => setShowChalkCard(false)} />
      )}

      {/* Confirm take modal */}
      {showConfirm && createPortal(
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowConfirm(false)}
        >
          <div
            className="chalk-card rounded-[4px] w-full max-w-xs overflow-hidden fade-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3" style={{ borderBottom: '1px dashed var(--dust-light)' }}>
              <span className="chalk-header text-base" style={{ color: 'var(--chalk-white)' }}>Confirm Bet</span>
            </div>

            <div className="p-4 space-y-3">
              <div className="text-sm" style={{ color: 'var(--chalk-white)', fontFamily: 'var(--font-chalk-body)' }}>
                You&apos;re taking <span className="chalk-header" style={{ color: displayDirColor }}>{counterDir.toUpperCase()}</span> {bet.target} {statLabel} on <span className="chalk-header">{bet.player}</span>
              </div>

              <div className="flex items-center justify-between py-2 px-3 rounded-[4px]" style={{ background: 'rgba(232,228,217,0.04)', border: '1px dashed rgba(232,228,217,0.08)' }}>
                <div>
                  <div className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>Your Stake</div>
                  <div className="text-lg tabular-nums chalk-score" style={{ color: 'var(--color-yellow)' }}>{bet.takerStake}</div>
                  {price !== null && <div className="text-[9px] tabular-nums" style={{ color: 'var(--chalk-dim)' }}>{formatUsd(bet.takerStake, price)}</div>}
                </div>
                <div className="text-lg" style={{ color: 'var(--chalk-ghost)' }}>&rarr;</div>
                <div className="text-right">
                  <div className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>Total Pot</div>
                  <div className="text-lg tabular-nums chalk-score" style={{ color: 'var(--color-green)' }}>{pool}</div>
                  {price !== null && <div className="text-[9px] tabular-nums" style={{ color: 'var(--chalk-dim)' }}>{formatUsd(pool, price)}</div>}
                </div>
              </div>

              <div className="text-[10px]" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
                vs {bet.creatorName} &middot; Odds: {takerOdds}
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

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: number;
}

interface CashoutProposal {
  id: string;
  proposerId: string;
  proposerName: string;
  proposerTake: number;
  otherTake: number;
  status: 'pending' | 'accepted' | 'denied' | 'countered' | 'expired';
  createdAt: number;
}

type ModalTab = 'detail' | 'chat' | 'cashout';

export function BetDetailModal({ bet, statLabel, takerOdds, creatorOdds, pool, isCreator, isOpen, loading, onCancel, onClose, price, userId, getAccessToken }: {
  bet: Bet; statLabel: string; takerOdds: string; creatorOdds: string; pool: number;
  isCreator: boolean; isOpen: boolean; loading: boolean;
  onCancel: () => void; onClose: () => void; price: number | null;
  userId?: string | null; getAccessToken?: () => Promise<string | null>;
}) {
  const isParticipant = bet.takerId && (userId === bet.creatorId || userId === bet.takerId);
  const isMatched = bet.status === 'matched';

  const [showShareCard, setShowShareCard] = useState(false);
  const [tab, setTab] = useState<ModalTab>(isParticipant ? 'chat' : 'detail');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatText, setChatText] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const dirColor = bet.direction === 'over' ? 'var(--color-green)' : 'var(--color-red)';

  // Cashout state
  const [proposals, setProposals] = useState<CashoutProposal[]>([]);
  const [cashoutAmount, setCashoutAmount] = useState('');
  const [cashoutLoading, setCashoutLoading] = useState(false);
  const [cashoutAction, setCashoutAction] = useState(false);

  // === Chat functions ===
  const fetchMessages = useCallback(async () => {
    if (!getAccessToken || !isParticipant) return;
    setChatLoading(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/bets/chat?betId=${bet.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages ?? []);
      }
    } catch { /* silent */ }
    finally { setChatLoading(false); }
  }, [bet.id, getAccessToken, isParticipant]);

  useEffect(() => {
    if (tab === 'chat' && isParticipant) fetchMessages();
  }, [tab, isParticipant, fetchMessages]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (tab !== 'chat' || !isParticipant) return;
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [tab, isParticipant, fetchMessages]);

  async function sendMessage() {
    if (!chatText.trim() || !getAccessToken || sending) return;
    setSending(true);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/bets/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ betId: bet.id, text: chatText.trim() }),
      });
      if (res.ok) {
        setChatText('');
        fetchMessages();
      }
    } catch { /* silent */ }
    finally { setSending(false); }
  }

  // === Cashout functions ===
  const fetchProposals = useCallback(async () => {
    if (!getAccessToken || !isParticipant) return;
    setCashoutLoading(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/bets/cashout?betId=${bet.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProposals(data.proposals ?? []);
      }
    } catch { /* silent */ }
    finally { setCashoutLoading(false); }
  }, [bet.id, getAccessToken, isParticipant]);

  useEffect(() => {
    if (tab === 'cashout' && isParticipant) fetchProposals();
  }, [tab, isParticipant, fetchProposals]);

  // Poll cashout proposals every 5s
  useEffect(() => {
    if (tab !== 'cashout' || !isParticipant) return;
    const interval = setInterval(fetchProposals, 5000);
    return () => clearInterval(interval);
  }, [tab, isParticipant, fetchProposals]);

  async function cashoutAction_fn(action: string, proposalId?: string, proposerTake?: number) {
    if (!getAccessToken) return;
    setCashoutAction(true);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/bets/cashout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ betId: bet.id, action, proposalId, proposerTake }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed');
      }
      setCashoutAmount('');
      fetchProposals();
    } catch { alert('Failed'); }
    finally { setCashoutAction(false); }
  }

  const pendingProposal = proposals.find((p) => p.status === 'pending');
  const pendingIsFromMe = pendingProposal?.proposerId === userId;
  const myTakeIfAccepted = pendingProposal ? (pendingIsFromMe ? pendingProposal.proposerTake : pendingProposal.otherTake) : 0;
  const theirTakeIfAccepted = pendingProposal ? (pendingIsFromMe ? pendingProposal.otherTake : pendingProposal.proposerTake) : 0;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="chalk-card rounded-[4px] w-full max-w-sm overflow-hidden fade-up flex flex-col"
        style={{ maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with tab toggle */}
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px dashed var(--dust-light)' }}>
          <div className="flex items-center gap-1 p-0.5 rounded-[4px]" style={{ background: 'var(--dust-light)' }}>
            <button
              onClick={() => setTab('detail')}
              className="px-2.5 py-1 rounded-[3px] text-[10px] chalk-header tracking-wide cursor-pointer transition-all"
              style={{
                background: tab === 'detail' ? 'rgba(245,217,96,0.12)' : 'transparent',
                color: tab === 'detail' ? 'var(--color-yellow)' : 'var(--chalk-ghost)',
              }}
            >
              Detail
            </button>
            {isParticipant && (
              <>
                <button
                  onClick={() => setTab('chat')}
                  className="px-2.5 py-1 rounded-[3px] text-[10px] chalk-header tracking-wide cursor-pointer transition-all flex items-center gap-1.5"
                  style={{
                    background: tab === 'chat' ? 'rgba(93,184,232,0.12)' : 'transparent',
                    color: tab === 'chat' ? 'var(--color-blue, #5db8e8)' : 'var(--chalk-ghost)',
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                  </svg>
                  Chat
                </button>
                {isMatched && (
                  <button
                    onClick={() => setTab('cashout')}
                    className="px-2.5 py-1 rounded-[3px] text-[10px] chalk-header tracking-wide cursor-pointer transition-all flex items-center gap-1.5"
                    style={{
                      background: tab === 'cashout' ? 'rgba(93,232,138,0.12)' : 'transparent',
                      color: tab === 'cashout' ? 'var(--color-green)' : 'var(--chalk-ghost)',
                    }}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                    </svg>
                    Cash Out
                  </button>
                )}
              </>
            )}
          </div>
          <button onClick={onClose} className="p-1 rounded-[4px] cursor-pointer" style={{ color: 'var(--chalk-ghost)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ===== DETAIL TAB ===== */}
        {tab === 'detail' && (
          <div className="p-4 space-y-4 overflow-y-auto">
            <div>
              <div className="text-lg chalk-header" style={{ color: 'var(--chalk-white)' }}>{bet.player}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-1.5 py-px rounded-[2px] text-[9px] chalk-header tracking-wide" style={{ background: 'rgba(93,232,138,0.15)', color: 'var(--color-green)', border: '1px dashed rgba(93,232,138,0.3)' }}>O</span>
                <span style={{ color: 'var(--chalk-ghost)', fontSize: '8px' }}>/</span>
                <span className="px-1.5 py-px rounded-[2px] text-[9px] chalk-header tracking-wide" style={{ background: 'rgba(232,93,93,0.15)', color: 'var(--color-red)', border: '1px dashed rgba(232,93,93,0.3)' }}>U</span>
                <span className="text-2xl tabular-nums chalk-score" style={{ color: 'var(--chalk-white)' }}>{bet.target}</span>
                <span className="text-sm" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>{statLabel}</span>
              </div>
            </div>

            <div className="text-center py-2.5 rounded-[4px]" style={{ background: 'rgba(232,228,217,0.04)', border: '1px dashed rgba(232,228,217,0.08)' }}>
              <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>Total Pot</div>
              <div className="text-2xl tabular-nums chalk-score" style={{ color: 'var(--chalk-white)' }}>{pool}</div>
              {price !== null && <div className="text-[10px] tabular-nums mt-0.5" style={{ color: 'var(--chalk-dim)', fontFamily: 'var(--font-chalk-body)' }}>{formatUsd(pool, price)}</div>}
            </div>

            <BetSidesBreakdown bet={bet} pool={pool} price={price} creatorOdds={creatorOdds} takerOdds={takerOdds} isCreator={isCreator} />

            <div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
              <span>By {bet.creatorName}</span>
              {bet.takerName && <><span style={{ opacity: 0.3 }}>|</span><span>Taken by {bet.takerName}</span></>}
              <span style={{ opacity: 0.3 }}>|</span>
              <span className="tabular-nums">{new Date(bet.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowShareCard(true)}
                className="flex-1 py-2.5 rounded-[4px] chalk-header text-sm tracking-wide cursor-pointer transition-all flex items-center justify-center gap-2"
                style={{ background: 'rgba(245,217,96,0.1)', border: '1.5px dashed rgba(245,217,96,0.25)', color: 'var(--color-yellow)' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
                </svg>
                Share
              </button>
              {isOpen && isCreator && (
                <button onClick={onCancel} disabled={loading} className="flex-1 py-2.5 rounded-[4px] chalk-header text-sm tracking-wide cursor-pointer disabled:opacity-50 transition-all" style={{ background: 'rgba(232,93,93,0.1)', border: '1.5px dashed rgba(232,93,93,0.25)', color: 'var(--color-red)' }}>
                  {loading ? '...' : 'Erase this prop'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ===== CHAT TAB ===== */}
        {tab === 'chat' && (
          <div className="flex flex-col" style={{ minHeight: 350 }}>
            <div className="flex items-center gap-2 px-4 py-2" style={{ background: 'rgba(232,228,217,0.03)', borderBottom: '1px dashed rgba(232,228,217,0.06)' }}>
              <span className="text-[11px] chalk-header truncate" style={{ color: 'var(--chalk-white)' }}>{bet.player}</span>
              <span className="text-[9px] chalk-header" style={{ color: dirColor }}>{bet.direction.toUpperCase()}</span>
              <span className="text-[11px] tabular-nums chalk-score" style={{ color: 'var(--chalk-white)' }}>{bet.target}</span>
              <span className="text-[9px]" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>{statLabel}</span>
            </div>

            <div className="flex-1 p-3 space-y-2.5 overflow-y-auto" style={{ maxHeight: 320, scrollbarWidth: 'thin', scrollbarColor: 'var(--dust-medium) transparent' }}>
              {chatLoading && messages.length === 0 ? (
                <div className="text-center py-8 text-[10px]" style={{ color: 'var(--chalk-ghost)' }}>Loading...</div>
              ) : messages.length === 0 ? (
                <div className="text-center py-8">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-2" style={{ color: 'var(--chalk-ghost)' }}>
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                  </svg>
                  <div className="text-[11px] chalk-header" style={{ color: 'var(--chalk-ghost)' }}>No messages yet</div>
                  <div className="text-[9px] mt-1" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)', opacity: 0.6 }}>Talk your talk</div>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.senderId === userId;
                  return (
                    <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      <span className="text-[8px] chalk-header tracking-wider mb-0.5" style={{ color: isMe ? 'var(--color-yellow)' : 'var(--color-blue, #5db8e8)' }}>{msg.senderName}</span>
                      <div className="px-2.5 py-1.5 rounded-[4px] text-[11px] max-w-[85%]" style={{ background: isMe ? 'rgba(245,217,96,0.1)' : 'rgba(93,184,232,0.08)', color: 'var(--chalk-white)', fontFamily: 'var(--font-chalk-body)', wordBreak: 'break-word' }}>{msg.text}</div>
                      <span className="text-[7px] tabular-nums mt-0.5" style={{ color: 'var(--chalk-ghost)' }}>{new Date(msg.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="flex gap-1.5 p-3" style={{ borderTop: '1px dashed rgba(232,228,217,0.08)' }}>
              <input type="text" value={chatText} onChange={(e) => setChatText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} placeholder="Talk your talk..." maxLength={500} className="flex-1 px-2.5 py-2 rounded-[4px] text-[11px] outline-none" style={{ background: 'rgba(232,228,217,0.06)', border: '1px dashed rgba(232,228,217,0.1)', color: 'var(--chalk-white)', fontFamily: 'var(--font-chalk-body)' }} />
              <button onClick={sendMessage} disabled={sending || !chatText.trim()} className="px-3 py-2 rounded-[4px] chalk-header text-[10px] tracking-wide cursor-pointer disabled:opacity-30 transition-all" style={{ background: 'rgba(93,184,232,0.15)', color: 'var(--color-blue, #5db8e8)' }}>{sending ? '...' : 'Send'}</button>
            </div>
          </div>
        )}

        {/* ===== CASH OUT TAB ===== */}
        {tab === 'cashout' && (
          <div className="flex flex-col" style={{ minHeight: 350 }}>
            {/* Compact prop summary bar */}
            <div className="flex items-center gap-2 px-4 py-2" style={{ background: 'rgba(232,228,217,0.03)', borderBottom: '1px dashed rgba(232,228,217,0.06)' }}>
              <span className="text-[11px] chalk-header truncate" style={{ color: 'var(--chalk-white)' }}>{bet.player}</span>
              <span className="text-[9px] chalk-header" style={{ color: dirColor }}>{bet.direction.toUpperCase()}</span>
              <span className="text-[11px] tabular-nums chalk-score" style={{ color: 'var(--chalk-white)' }}>{bet.target}</span>
              <span className="text-[9px]" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>{statLabel}</span>
              <span className="ml-auto text-[9px] tabular-nums chalk-header" style={{ color: 'var(--color-yellow)' }}>Pot: {pool}</span>
            </div>

            <div className="flex-1 p-4 space-y-4 overflow-y-auto">
              {cashoutLoading && proposals.length === 0 ? (
                <div className="text-center py-8 text-[10px]" style={{ color: 'var(--chalk-ghost)' }}>Loading...</div>
              ) : (
                <>
                  {/* Active proposal */}
                  {pendingProposal ? (
                    <div className="rounded-[4px] p-3.5 space-y-3" style={{ background: 'rgba(93,232,138,0.04)', border: '1px dashed rgba(93,232,138,0.2)' }}>
                      <div className="text-[9px] uppercase tracking-wider chalk-header" style={{ color: 'var(--color-green)' }}>
                        {pendingIsFromMe ? 'Your offer (waiting...)' : `${pendingProposal.proposerName} offers`}
                      </div>

                      {/* Visual split */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 text-center py-2 rounded-[4px]" style={{ background: 'rgba(245,217,96,0.06)', border: '1px dashed rgba(245,217,96,0.12)' }}>
                          <div className="text-[8px] uppercase tracking-wider" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
                            {pendingIsFromMe ? 'You get' : pendingProposal.proposerName}
                          </div>
                          <div className="text-lg tabular-nums chalk-score" style={{ color: 'var(--color-yellow)' }}>
                            {pendingIsFromMe ? pendingProposal.proposerTake : pendingProposal.proposerTake}
                          </div>
                        </div>
                        <div className="text-[10px]" style={{ color: 'var(--chalk-ghost)' }}>/</div>
                        <div className="flex-1 text-center py-2 rounded-[4px]" style={{ background: 'rgba(93,184,232,0.06)', border: '1px dashed rgba(93,184,232,0.12)' }}>
                          <div className="text-[8px] uppercase tracking-wider" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
                            {pendingIsFromMe ? 'They get' : 'You get'}
                          </div>
                          <div className="text-lg tabular-nums chalk-score" style={{ color: 'var(--color-blue, #5db8e8)' }}>
                            {pendingIsFromMe ? pendingProposal.otherTake : pendingProposal.otherTake}
                          </div>
                        </div>
                      </div>

                      {/* Actions for the receiver */}
                      {!pendingIsFromMe ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => cashoutAction_fn('accept', pendingProposal.id)}
                            disabled={cashoutAction}
                            className="flex-1 py-2 rounded-[4px] chalk-header text-[10px] tracking-wide cursor-pointer disabled:opacity-50 transition-all"
                            style={{ background: 'rgba(93,232,138,0.15)', border: '1px dashed rgba(93,232,138,0.3)', color: 'var(--color-green)' }}
                          >
                            {cashoutAction ? '...' : 'Accept'}
                          </button>
                          <button
                            onClick={() => cashoutAction_fn('deny', pendingProposal.id)}
                            disabled={cashoutAction}
                            className="flex-1 py-2 rounded-[4px] chalk-header text-[10px] tracking-wide cursor-pointer disabled:opacity-50 transition-all"
                            style={{ background: 'rgba(232,93,93,0.1)', border: '1px dashed rgba(232,93,93,0.25)', color: 'var(--color-red)' }}
                          >
                            Deny
                          </button>
                          <button
                            onClick={() => {
                              const counter = prompt(`Counter: how much do YOU want? (pot is ${pool})`);
                              if (counter && Number(counter) > 0 && Number(counter) <= pool) {
                                cashoutAction_fn('counter', pendingProposal.id, Number(counter));
                              }
                            }}
                            disabled={cashoutAction}
                            className="flex-1 py-2 rounded-[4px] chalk-header text-[10px] tracking-wide cursor-pointer disabled:opacity-50 transition-all"
                            style={{ background: 'rgba(245,217,96,0.1)', border: '1px dashed rgba(245,217,96,0.25)', color: 'var(--color-yellow)' }}
                          >
                            Counter
                          </button>
                        </div>
                      ) : (
                        <div className="text-[10px] text-center" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
                          Waiting for {bet.takerId === userId ? bet.creatorName : bet.takerName} to respond...
                        </div>
                      )}
                    </div>
                  ) : (
                    /* No active proposal — show propose form */
                    <div className="space-y-3">
                      <div className="text-center">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-2" style={{ color: 'var(--chalk-ghost)' }}>
                          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                        </svg>
                        <div className="text-[11px] chalk-header" style={{ color: 'var(--chalk-white)' }}>Propose a Cash Out</div>
                        <div className="text-[9px] mt-1" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)', opacity: 0.6 }}>
                          Split the pot early — the other side has to agree
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="text-[9px] uppercase tracking-wider chalk-header" style={{ color: 'var(--chalk-ghost)' }}>I want to walk away with</div>
                        <input
                          type="number"
                          value={cashoutAmount}
                          onChange={(e) => setCashoutAmount(e.target.value)}
                          placeholder={`0 — ${pool}`}
                          min={0}
                          max={pool}
                          className="w-full px-3 py-2.5 rounded-[4px] text-sm outline-none tabular-nums"
                          style={{ background: 'rgba(232,228,217,0.06)', border: '1px dashed rgba(232,228,217,0.1)', color: 'var(--chalk-white)', fontFamily: 'var(--font-chalk-body)' }}
                        />
                        {Number(cashoutAmount) > 0 && Number(cashoutAmount) <= pool && (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-[4px]" style={{ background: 'rgba(232,228,217,0.03)', border: '1px dashed rgba(232,228,217,0.06)' }}>
                            <div className="flex-1">
                              <div className="text-[8px] uppercase tracking-wider" style={{ color: 'var(--chalk-ghost)' }}>You</div>
                              <div className="text-sm tabular-nums chalk-score" style={{ color: 'var(--color-green)' }}>{Number(cashoutAmount)}</div>
                            </div>
                            <div className="text-[10px]" style={{ color: 'var(--chalk-ghost)' }}>/</div>
                            <div className="flex-1 text-right">
                              <div className="text-[8px] uppercase tracking-wider" style={{ color: 'var(--chalk-ghost)' }}>Them</div>
                              <div className="text-sm tabular-nums chalk-score" style={{ color: 'var(--color-blue, #5db8e8)' }}>{pool - Number(cashoutAmount)}</div>
                            </div>
                          </div>
                        )}
                        <button
                          onClick={() => {
                            const amt = Number(cashoutAmount);
                            if (amt > 0 && amt <= pool) cashoutAction_fn('propose', undefined, amt);
                          }}
                          disabled={cashoutAction || !cashoutAmount || Number(cashoutAmount) <= 0 || Number(cashoutAmount) > pool}
                          className="w-full py-2.5 rounded-[4px] chalk-header text-[11px] tracking-wide cursor-pointer disabled:opacity-30 transition-all"
                          style={{ background: 'rgba(93,232,138,0.12)', border: '1px dashed rgba(93,232,138,0.25)', color: 'var(--color-green)' }}
                        >
                          {cashoutAction ? '...' : 'Send Offer'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* History of past proposals */}
                  {proposals.filter((p) => p.status !== 'pending').length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[8px] uppercase tracking-wider chalk-header" style={{ color: 'var(--chalk-ghost)' }}>History</div>
                      {proposals.filter((p) => p.status !== 'pending').map((p) => (
                        <div key={p.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-[4px] text-[10px]" style={{ background: 'rgba(232,228,217,0.03)', fontFamily: 'var(--font-chalk-body)' }}>
                          <span style={{ color: 'var(--chalk-ghost)' }}>{p.proposerName}</span>
                          <span className="tabular-nums" style={{ color: 'var(--chalk-white)' }}>{p.proposerTake}/{p.otherTake}</span>
                          <span className="ml-auto chalk-header text-[8px] tracking-wider" style={{
                            color: p.status === 'accepted' ? 'var(--color-green)' : p.status === 'denied' ? 'var(--color-red)' : 'var(--color-yellow)',
                          }}>
                            {p.status.toUpperCase()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
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
