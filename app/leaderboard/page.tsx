'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@/hooks/useUser';

export const dynamic = 'force-dynamic';

interface LeaderboardEntry {
  userId: string;
  displayName: string;
  avatarUrl: string;
  wins: number;
  losses: number;
  pushes: number;
  winRate: number;
  totalProfit: number;
  percentGain: number;
  volume: number;
  betsCount: number;
  openBets: number;
  liveBets: number;
  pendingChalk: number;
}

type SortKey = 'totalProfit' | 'percentGain' | 'volume' | 'pendingChalk' | 'openBets' | 'liveBets';

export default function LeaderboardPage() {
  const { userId, ready } = useUser();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('totalProfit');
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/leaderboard')
      .then((r) => r.json())
      .then((data) => setEntries(data.leaderboard || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const sorted = [...entries].sort((a, b) => {
    return sortAsc ? a[sortKey] - b[sortKey] : b[sortKey] - a[sortKey];
  });

  const totalPlayers = entries.length;
  const totalVolume = entries.reduce((s, e) => s + e.volume, 0);
  const totalLive = entries.reduce((s, e) => s + e.liveBets, 0);

  const columns: { key: SortKey; label: string; short: string }[] = [
    { key: 'totalProfit', label: 'Profit', short: 'Profit' },
    { key: 'percentGain', label: 'ROI%', short: 'ROI%' },
    { key: 'volume', label: 'Volume', short: 'Vol' },
    { key: 'pendingChalk', label: 'At Risk', short: 'Risk' },
    { key: 'openBets', label: 'Open', short: 'Open' },
    { key: 'liveBets', label: 'Live', short: 'Live' },
  ];

  if (!ready) return null;

  return (
    <div className="pinned-header-layout max-w-4xl mx-auto px-4">
      {/* Header */}
      <div className="pinned-header pt-6 pb-4">
        <h1
          className="chalk-header text-2xl mb-1"
          style={{ color: 'var(--chalk-white)' }}
        >
          Rankings
        </h1>
        <p
          className="text-sm"
          style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}
        >
          Who&apos;s up, who&apos;s down, who&apos;s got chalk on the line
        </p>
      </div>

      {/* Content */}
      <div className="pinned-scroll scrollbar-hide">
        {/* Summary cards */}
        {!loading && entries.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-5 fade-up">
            <SummaryCard label="Players" value={String(totalPlayers)} />
            <SummaryCard label="Volume" value={formatNum(totalVolume)} />
            <SummaryCard label="Live Bets" value={String(totalLive)} accent />
          </div>
        )}

        {loading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-14 rounded-[4px] shimmer" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div
            className="text-center py-16"
            style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}
          >
            No settled bets yet
          </div>
        ) : (
          <div className="chalk-card rounded-[4px] overflow-hidden">
            {/* Column headers — desktop */}
            <div
              className="hidden sm:grid items-center px-3 py-2 text-xs"
              style={{
                gridTemplateColumns: '2.5rem 1fr 5rem repeat(4, minmax(3rem, 4.5rem))',
                borderBottom: '1px dashed rgba(232,228,217,0.18)',
                color: 'var(--chalk-ghost)',
                fontFamily: 'var(--font-chalk-body)',
              }}
            >
              <span>#</span>
              <span>User</span>
              <span className="text-center">Record</span>
              {columns.slice(0, 4).map((col) => (
                <button
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="text-right cursor-pointer select-none transition-colors duration-150"
                  style={{
                    color: sortKey === col.key ? 'var(--color-yellow)' : 'var(--chalk-ghost)',
                  }}
                >
                  {col.short}
                  {sortKey === col.key && (
                    <span className="ml-0.5">{sortAsc ? '↑' : '↓'}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Column headers — mobile */}
            <div
              className="grid sm:hidden items-center px-3 py-2 text-xs"
              style={{
                gridTemplateColumns: '2rem 1fr auto',
                borderBottom: '1px dashed rgba(232,228,217,0.18)',
                color: 'var(--chalk-ghost)',
                fontFamily: 'var(--font-chalk-body)',
              }}
            >
              <span>#</span>
              <span>User</span>
              <button
                onClick={() => handleSort('totalProfit')}
                className="text-right cursor-pointer select-none"
                style={{ color: sortKey === 'totalProfit' ? 'var(--color-yellow)' : 'var(--chalk-ghost)' }}
              >
                Profit{sortKey === 'totalProfit' && <span className="ml-0.5">{sortAsc ? '↑' : '↓'}</span>}
              </button>
            </div>

            {/* Rows */}
            {sorted.map((entry, i) => {
              const isMe = userId === entry.userId;
              const isTop3 = i < 3;
              const isExpanded = expandedRow === entry.userId;
              const record = `${entry.wins}-${entry.losses}-${entry.pushes}`;

              return (
                <div key={entry.userId}>
                  {/* Desktop row */}
                  <div
                    className="hidden sm:grid items-center px-3 py-2.5 transition-all duration-200 fade-up"
                    style={{
                      gridTemplateColumns: '2.5rem 1fr 5rem repeat(4, minmax(3rem, 4.5rem))',
                      borderBottom: '1px dashed rgba(232,228,217,0.08)',
                      background: isMe
                        ? 'rgba(245,217,96,0.06)'
                        : isTop3
                          ? 'rgba(245,217,96,0.02)'
                          : 'transparent',
                      animationDelay: `${Math.min(i * 20, 300)}ms`,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = isMe
                        ? 'rgba(245,217,96,0.10)'
                        : 'rgba(232,228,217,0.04)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 2px 12px rgba(245,217,96,0.06)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = isMe
                        ? 'rgba(245,217,96,0.06)'
                        : isTop3
                          ? 'rgba(245,217,96,0.02)'
                          : 'transparent';
                      e.currentTarget.style.transform = '';
                      e.currentTarget.style.boxShadow = '';
                    }}
                  >
                    <RankBadge rank={i + 1} />

                    <UserCell entry={entry} isMe={isMe} />

                    {/* Record */}
                    <span
                      className="chalk-score text-xs text-center"
                      style={{ color: 'var(--chalk-dim)' }}
                    >
                      {record}
                    </span>

                    {/* Profit */}
                    <span
                      className="chalk-score text-sm text-right"
                      style={{
                        color: entry.totalProfit > 0
                          ? 'var(--color-green)'
                          : entry.totalProfit < 0
                            ? 'var(--color-red)'
                            : 'var(--chalk-dim)',
                      }}
                    >
                      {entry.totalProfit > 0 ? '+' : ''}{formatNum(entry.totalProfit)}
                    </span>

                    {/* ROI% */}
                    <span
                      className="chalk-score text-sm text-right"
                      style={{
                        color: entry.percentGain > 0
                          ? 'var(--color-green)'
                          : entry.percentGain < 0
                            ? 'var(--color-red)'
                            : 'var(--chalk-dim)',
                      }}
                    >
                      {entry.percentGain > 0 ? '+' : ''}{entry.percentGain}%
                    </span>

                    {/* Volume */}
                    <span
                      className="chalk-score text-sm text-right"
                      style={{ color: 'var(--chalk-dim)' }}
                    >
                      {formatNum(entry.volume)}
                    </span>

                    {/* At Risk */}
                    <span
                      className="chalk-score text-sm text-right"
                      style={{
                        color: entry.pendingChalk > 0 ? 'var(--color-yellow)' : 'var(--chalk-ghost)',
                      }}
                    >
                      {entry.pendingChalk > 0 ? formatNum(entry.pendingChalk) : '—'}
                    </span>
                  </div>

                  {/* Mobile row */}
                  <div
                    className="sm:hidden fade-up"
                    style={{
                      borderBottom: '1px dashed rgba(232,228,217,0.08)',
                      background: isMe
                        ? 'rgba(245,217,96,0.06)'
                        : isTop3
                          ? 'rgba(245,217,96,0.02)'
                          : 'transparent',
                      animationDelay: `${Math.min(i * 20, 300)}ms`,
                    }}
                  >
                    <button
                      className="grid w-full items-center px-3 py-2.5 text-left"
                      style={{ gridTemplateColumns: '2rem 1fr auto' }}
                      onClick={() => setExpandedRow(isExpanded ? null : entry.userId)}
                    >
                      <RankBadge rank={i + 1} />
                      <UserCell entry={entry} isMe={isMe} />
                      <span
                        className="chalk-score text-sm text-right"
                        style={{
                          color: entry.totalProfit > 0
                            ? 'var(--color-green)'
                            : entry.totalProfit < 0
                              ? 'var(--color-red)'
                              : 'var(--chalk-dim)',
                        }}
                      >
                        {entry.totalProfit > 0 ? '+' : ''}{formatNum(entry.totalProfit)}
                      </span>
                    </button>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div
                        className="grid grid-cols-3 gap-2 px-3 pb-3 text-center fade-up"
                        style={{ fontFamily: 'var(--font-chalk-body)' }}
                      >
                        <MobileStat label="Record" value={record} />
                        <MobileStat
                          label="ROI"
                          value={`${entry.percentGain > 0 ? '+' : ''}${entry.percentGain}%`}
                          color={entry.percentGain > 0 ? 'var(--color-green)' : entry.percentGain < 0 ? 'var(--color-red)' : undefined}
                        />
                        <MobileStat label="Volume" value={formatNum(entry.volume)} />
                        <MobileStat
                          label="At Risk"
                          value={entry.pendingChalk > 0 ? formatNum(entry.pendingChalk) : '—'}
                          color={entry.pendingChalk > 0 ? 'var(--color-yellow)' : undefined}
                        />
                        <MobileStat label="Open" value={String(entry.openBets)} />
                        <MobileStat label="Live" value={String(entry.liveBets)} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const isTop3 = rank <= 3;
  const medals = ['', '#f5d960', '#c0c0c0', '#cd7f32']; // gold, silver, bronze

  if (isTop3) {
    return (
      <span
        className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold"
        style={{
          background: `${medals[rank]}22`,
          border: `1.5px solid ${medals[rank]}`,
          color: medals[rank],
          fontFamily: 'var(--font-chalk-header)',
        }}
      >
        {rank}
      </span>
    );
  }

  return (
    <span
      className="chalk-score text-sm"
      style={{ color: 'var(--chalk-ghost)' }}
    >
      {rank}
    </span>
  );
}

function UserCell({ entry, isMe }: { entry: LeaderboardEntry; isMe: boolean }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      {entry.avatarUrl ? (
        <img
          src={entry.avatarUrl}
          alt=""
          className="w-6 h-6 rounded-full flex-shrink-0"
        />
      ) : (
        <div
          className="w-6 h-6 rounded-full flex-shrink-0"
          style={{ background: 'rgba(232,228,217,0.1)' }}
        />
      )}
      <span
        className="text-sm truncate"
        style={{
          color: isMe ? 'var(--color-yellow)' : 'var(--chalk-white)',
          fontFamily: 'var(--font-chalk-body)',
        }}
      >
        {entry.displayName}
        {isMe && (
          <span className="ml-1.5 text-xs" style={{ color: 'var(--chalk-ghost)' }}>
            (you)
          </span>
        )}
      </span>
    </div>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className="chalk-card rounded-[4px] px-3 py-3 text-center"
      style={{
        borderColor: accent ? 'rgba(245,217,96,0.25)' : undefined,
      }}
    >
      <div
        className="chalk-score text-lg"
        style={{ color: accent ? 'var(--color-yellow)' : 'var(--chalk-white)' }}
      >
        {value}
      </div>
      <div
        className="text-xs mt-0.5"
        style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}
      >
        {label}
      </div>
    </div>
  );
}

function MobileStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div
      className="rounded-[4px] py-1.5 px-2"
      style={{ background: 'rgba(232,228,217,0.04)' }}
    >
      <div
        className="chalk-score text-sm"
        style={{ color: color || 'var(--chalk-white)' }}
      >
        {value}
      </div>
      <div
        className="text-[10px] mt-0.5"
        style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}
      >
        {label}
      </div>
    </div>
  );
}

function formatNum(n: number): string {
  if (Math.abs(n) >= 1000) {
    return (n / 1000).toFixed(1) + 'k';
  }
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}
