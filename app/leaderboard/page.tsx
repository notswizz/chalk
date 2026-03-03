'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@/hooks/useUser';

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
}

type SortKey = 'totalProfit' | 'winRate' | 'percentGain' | 'volume' | 'betsCount' | 'wins';

export default function LeaderboardPage() {
  const { userId, ready } = useUser();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('totalProfit');
  const [sortAsc, setSortAsc] = useState(false);

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
    const diff = sortAsc ? a[sortKey] - b[sortKey] : b[sortKey] - a[sortKey];
    return diff;
  });

  const columns: { key: SortKey; label: string; short: string }[] = [
    { key: 'totalProfit', label: 'Profit', short: 'Profit' },
    { key: 'winRate', label: 'Win%', short: 'Win%' },
    { key: 'percentGain', label: 'ROI%', short: 'ROI%' },
    { key: 'volume', label: 'Volume', short: 'Vol' },
    { key: 'betsCount', label: 'Bets', short: 'Bets' },
  ];

  if (!ready) return null;

  return (
    <div className="pinned-header-layout max-w-3xl mx-auto px-4">
      {/* Header */}
      <div className="pinned-header pt-6 pb-4">
        <h1
          className="chalk-header text-xl mb-1"
          style={{ color: 'var(--chalk-white)' }}
        >
          Leaderboard
        </h1>
        <p
          className="text-sm"
          style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}
        >
          Rankings by settled bets
        </p>
      </div>

      {/* Table */}
      <div className="pinned-scroll scrollbar-hide">
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
            {/* Column headers */}
            <div
              className="grid items-center px-3 py-2 text-xs"
              style={{
                gridTemplateColumns: '2.5rem 1fr repeat(5, minmax(3.5rem, 5rem))',
                borderBottom: '1px dashed rgba(232,228,217,0.18)',
                color: 'var(--chalk-ghost)',
                fontFamily: 'var(--font-chalk-body)',
              }}
            >
              <span>#</span>
              <span>User</span>
              {columns.map((col) => (
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

            {/* Rows */}
            {sorted.map((entry, i) => {
              const isMe = userId === entry.userId;
              return (
                <div
                  key={entry.userId}
                  className="grid items-center px-3 py-2.5 transition-colors duration-150 fade-up"
                  style={{
                    gridTemplateColumns: '2.5rem 1fr repeat(5, minmax(3.5rem, 5rem))',
                    borderBottom: '1px dashed rgba(232,228,217,0.08)',
                    background: isMe ? 'rgba(245,217,96,0.06)' : 'transparent',
                    animationDelay: `${Math.min(i * 20, 300)}ms`,
                  }}
                >
                  {/* Rank */}
                  <span
                    className="chalk-score text-sm"
                    style={{ color: i < 3 ? 'var(--color-yellow)' : 'var(--chalk-dim)' }}
                  >
                    {i + 1}
                  </span>

                  {/* User */}
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
                        <span
                          className="ml-1.5 text-xs"
                          style={{ color: 'var(--chalk-ghost)' }}
                        >
                          (you)
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Profit */}
                  <span
                    className="chalk-score text-sm text-right"
                    style={{
                      color:
                        entry.totalProfit > 0
                          ? 'var(--color-green)'
                          : entry.totalProfit < 0
                            ? 'var(--color-red)'
                            : 'var(--chalk-dim)',
                    }}
                  >
                    {entry.totalProfit > 0 ? '+' : ''}
                    {formatNum(entry.totalProfit)}
                  </span>

                  {/* Win% */}
                  <span
                    className="chalk-score text-sm text-right"
                    style={{ color: 'var(--chalk-dim)' }}
                  >
                    {entry.winRate}%
                  </span>

                  {/* ROI% */}
                  <span
                    className="chalk-score text-sm text-right"
                    style={{
                      color:
                        entry.percentGain > 0
                          ? 'var(--color-green)'
                          : entry.percentGain < 0
                            ? 'var(--color-red)'
                            : 'var(--chalk-dim)',
                    }}
                  >
                    {entry.percentGain > 0 ? '+' : ''}
                    {entry.percentGain}%
                  </span>

                  {/* Volume */}
                  <span
                    className="chalk-score text-sm text-right"
                    style={{ color: 'var(--chalk-dim)' }}
                  >
                    {formatNum(entry.volume)}
                  </span>

                  {/* Bets */}
                  <span
                    className="chalk-score text-sm text-right"
                    style={{ color: 'var(--chalk-dim)' }}
                  >
                    {entry.betsCount}
                  </span>
                </div>
              );
            })}
          </div>
        )}
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
