'use client';

import { useEffect, useState, useCallback } from 'react';

interface AdminStats {
  overview: {
    totalUsers: number;
    totalCoinsInCirculation: number;
    totalReferrals: number;
    totalBets: number;
    totalSettled: number;
    totalOpen: number;
    totalMatched: number;
    totalCancelled: number;
    totalVolume: number;
    openVolume: number;
    matchedVolume: number;
    totalCreatorWins: number;
    totalTakerWins: number;
    totalPushes: number;
  };
  chalkbot: {
    totalBetsCreated: number;
    wins: number;
    losses: number;
    pushes: number;
    winRate: number;
    tokensEmitted: number;
    tokensGained: number;
    netTokens: number;
  };
  transactions: {
    totalDeposits: number;
    totalDepositAmount: number;
    totalWithdrawals: number;
    totalWithdrawalAmount: number;
    pendingWithdrawals: number;
    failedWithdrawals: number;
    netFlow: number;
  };
  volumeBySport: Record<string, number>;
  volumeByDay: [string, number][];
  betsByDay: [string, number][];
  topPlayers: { id: string; name: string; profit: number; wins: number; losses: number; volume: number }[];
  bottomPlayers: { id: string; name: string; profit: number; wins: number; losses: number; volume: number }[];
  topHolders: { name: string; coins: number }[];
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [key, setKey] = useState('');
  const [authed, setAuthed] = useState(false);

  const fetchStats = useCallback(async (apiKey: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/stats?key=${encodeURIComponent(apiKey)}`);
      if (res.status === 401) {
        setError('Invalid admin key');
        setAuthed(false);
        return;
      }
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      setStats(data);
      setAuthed(true);
      localStorage.setItem('admin_key', apiKey);
    } catch {
      setError('Failed to fetch stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('admin_key');
    if (saved) {
      setKey(saved);
      fetchStats(saved);
    } else {
      setLoading(false);
    }
  }, [fetchStats]);

  if (!authed) {
    return (
      <div className="max-w-md mx-auto px-4 pt-20">
        <h1
          className="chalk-header text-2xl mb-4"
          style={{ color: 'var(--chalk-white)' }}
        >
          Admin Dashboard
        </h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetchStats(key);
          }}
        >
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Enter admin key"
            className="w-full px-3 py-2 rounded-[4px] text-sm"
            style={{
              background: 'rgba(232,228,217,0.06)',
              border: '1px solid rgba(232,228,217,0.15)',
              color: 'var(--chalk-white)',
              fontFamily: 'var(--font-chalk-body)',
            }}
          />
          <button
            type="submit"
            className="mt-3 w-full py-2 rounded-[4px] text-sm cursor-pointer"
            style={{
              background: 'var(--color-yellow)',
              color: '#1a1a1a',
              fontFamily: 'var(--font-chalk-header)',
            }}
          >
            {loading ? 'Loading...' : 'Enter'}
          </button>
          {error && (
            <p className="mt-2 text-sm" style={{ color: 'var(--color-red)' }}>
              {error}
            </p>
          )}
        </form>
      </div>
    );
  }

  if (!stats) return null;

  const { overview, chalkbot, transactions } = stats;

  return (
    <div className="pinned-header-layout max-w-6xl mx-auto px-4">
      <div className="pinned-header pt-6 pb-4 flex items-center justify-between">
        <div>
          <h1
            className="chalk-header text-2xl mb-1"
            style={{ color: 'var(--chalk-white)' }}
          >
            Admin Dashboard
          </h1>
        </div>
        <button
          onClick={() => fetchStats(key)}
          className="px-3 py-1.5 rounded-[4px] text-xs cursor-pointer"
          style={{
            background: 'rgba(232,228,217,0.08)',
            border: '1px solid rgba(232,228,217,0.15)',
            color: 'var(--chalk-dim)',
            fontFamily: 'var(--font-chalk-body)',
          }}
        >
          Refresh
        </button>
      </div>

      <div className="pinned-scroll scrollbar-hide space-y-6 pb-8">
        {/* ── Platform Overview ── */}
        <Section title="Platform Overview">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Total Users" value={fmt(overview.totalUsers)} />
            <StatCard label="Total Bets" value={fmt(overview.totalBets)} />
            <StatCard label="Total Volume" value={fmt(overview.totalVolume)} accent />
            <StatCard label="Coins in Circulation" value={fmt(overview.totalCoinsInCirculation)} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
            <StatCard label="Open Bets" value={fmt(overview.totalOpen)} sub={`${fmt(overview.openVolume)} locked`} />
            <StatCard label="Live Bets" value={fmt(overview.totalMatched)} sub={`${fmt(overview.matchedVolume)} locked`} accent />
            <StatCard label="Settled" value={fmt(overview.totalSettled)} />
            <StatCard label="Cancelled" value={fmt(overview.totalCancelled)} />
          </div>
          <div className="grid grid-cols-3 gap-3 mt-3">
            <StatCard label="Creator Wins" value={fmt(overview.totalCreatorWins)} />
            <StatCard label="Taker Wins" value={fmt(overview.totalTakerWins)} />
            <StatCard label="Pushes" value={fmt(overview.totalPushes)} />
          </div>
        </Section>

        {/* ── ChalkBot ── */}
        <Section title="ChalkBot">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Bets Created" value={fmt(chalkbot.totalBetsCreated)} />
            <StatCard
              label="Record"
              value={`${chalkbot.wins}-${chalkbot.losses}-${chalkbot.pushes}`}
            />
            <StatCard
              label="Win Rate"
              value={`${chalkbot.winRate}%`}
              color={chalkbot.winRate >= 50 ? 'var(--color-green)' : 'var(--color-red)'}
            />
            <StatCard
              label="Net Tokens"
              value={fmt(chalkbot.netTokens)}
              color={chalkbot.netTokens >= 0 ? 'var(--color-green)' : 'var(--color-red)'}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <StatCard
              label="Tokens Emitted"
              value={fmt(chalkbot.tokensEmitted)}
              sub="paid to users who won"
              color="var(--color-red)"
            />
            <StatCard
              label="Tokens Gained"
              value={fmt(chalkbot.tokensGained)}
              sub="absorbed from user losses"
              color="var(--color-green)"
            />
          </div>
        </Section>


        {/* ── Volume by Sport ── */}
        <Section title="Volume by Sport">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(stats.volumeBySport)
              .sort(([, a], [, b]) => b - a)
              .map(([sport, vol]) => (
                <StatCard
                  key={sport}
                  label={sport.toUpperCase()}
                  value={fmt(vol)}
                  sub={`${overview.totalVolume > 0 ? Math.round((vol / overview.totalVolume) * 100) : 0}% of total`}
                />
              ))}
          </div>
        </Section>

        {/* ── Volume by Day ── */}
        <Section title="Daily Volume (Last 30 Days)">
          <div className="chalk-card rounded-[4px] overflow-hidden">
            <div
              className="grid items-center px-3 py-2 text-xs"
              style={{
                gridTemplateColumns: '7rem 1fr 5rem',
                borderBottom: '1px dashed rgba(232,228,217,0.18)',
                color: 'var(--chalk-ghost)',
                fontFamily: 'var(--font-chalk-body)',
              }}
            >
              <span>Date</span>
              <span>Volume</span>
              <span className="text-right">Bets</span>
            </div>
            {stats.volumeByDay.map(([day, vol]) => {
              const bets = stats.betsByDay.find(([d]) => d === day)?.[1] || 0;
              const maxVol = Math.max(...stats.volumeByDay.map(([, v]) => v), 1);
              return (
                <div
                  key={day}
                  className="grid items-center px-3 py-2 text-sm"
                  style={{
                    gridTemplateColumns: '7rem 1fr 5rem',
                    borderBottom: '1px dashed rgba(232,228,217,0.08)',
                    fontFamily: 'var(--font-chalk-body)',
                  }}
                >
                  <span style={{ color: 'var(--chalk-dim)' }}>{day}</span>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 rounded-sm"
                      style={{
                        width: `${Math.max((vol / maxVol) * 100, 2)}%`,
                        background: 'var(--color-yellow)',
                        opacity: 0.6,
                      }}
                    />
                    <span className="chalk-score text-xs" style={{ color: 'var(--chalk-white)' }}>
                      {fmt(vol)}
                    </span>
                  </div>
                  <span className="text-right chalk-score" style={{ color: 'var(--chalk-ghost)' }}>
                    {bets}
                  </span>
                </div>
              );
            })}
            {stats.volumeByDay.length === 0 && (
              <div className="px-3 py-4 text-center text-sm" style={{ color: 'var(--chalk-ghost)' }}>
                No data yet
              </div>
            )}
          </div>
        </Section>

        {/* ── Top Players ── */}
        <div className="grid sm:grid-cols-2 gap-6">
          <Section title="Top Winners">
            <PlayerTable players={stats.topPlayers} />
          </Section>
          <Section title="Biggest Losers">
            <PlayerTable players={stats.bottomPlayers} />
          </Section>
        </div>

        {/* ── Top Holders ── */}
        <Section title="Top CHALK Holders">
          <div className="chalk-card rounded-[4px] overflow-hidden">
            {stats.topHolders.map((h, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-3 py-2"
                style={{
                  borderBottom: '1px dashed rgba(232,228,217,0.08)',
                  fontFamily: 'var(--font-chalk-body)',
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs w-5" style={{ color: 'var(--chalk-ghost)' }}>
                    {i + 1}
                  </span>
                  <span className="text-sm" style={{ color: 'var(--chalk-white)' }}>
                    {h.name}
                  </span>
                </div>
                <span
                  className="chalk-score text-sm"
                  style={{ color: 'var(--color-yellow)' }}
                >
                  {fmt(h.coins)}
                </span>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Referrals ── */}
        <Section title="Referrals">
          <StatCard label="Total Referrals" value={fmt(overview.totalReferrals)} />
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2
        className="chalk-header text-lg mb-3"
        style={{ color: 'var(--color-yellow)' }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  color?: string;
}) {
  return (
    <div
      className="chalk-card rounded-[4px] px-3 py-3"
      style={{
        borderColor: accent ? 'rgba(245,217,96,0.25)' : undefined,
      }}
    >
      <div
        className="chalk-score text-lg"
        style={{ color: color || (accent ? 'var(--color-yellow)' : 'var(--chalk-white)') }}
      >
        {value}
      </div>
      <div
        className="text-xs mt-0.5"
        style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}
      >
        {label}
      </div>
      {sub && (
        <div
          className="text-[10px] mt-0.5"
          style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)', opacity: 0.7 }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

function PlayerTable({
  players,
}: {
  players: { id: string; name: string; profit: number; wins: number; losses: number; volume: number }[];
}) {
  return (
    <div className="chalk-card rounded-[4px] overflow-hidden">
      <div
        className="grid items-center px-3 py-2 text-xs"
        style={{
          gridTemplateColumns: '1.5rem 1fr 4rem 4rem 4rem',
          borderBottom: '1px dashed rgba(232,228,217,0.18)',
          color: 'var(--chalk-ghost)',
          fontFamily: 'var(--font-chalk-body)',
        }}
      >
        <span>#</span>
        <span>User</span>
        <span className="text-right">Profit</span>
        <span className="text-right">Record</span>
        <span className="text-right">Volume</span>
      </div>
      {players.map((p, i) => (
        <div
          key={p.id}
          className="grid items-center px-3 py-2 text-sm"
          style={{
            gridTemplateColumns: '1.5rem 1fr 4rem 4rem 4rem',
            borderBottom: '1px dashed rgba(232,228,217,0.08)',
            fontFamily: 'var(--font-chalk-body)',
          }}
        >
          <span style={{ color: 'var(--chalk-ghost)' }}>{i + 1}</span>
          <span className="truncate" style={{ color: 'var(--chalk-white)' }}>
            {p.name}
          </span>
          <span
            className="chalk-score text-right"
            style={{
              color: p.profit > 0 ? 'var(--color-green)' : p.profit < 0 ? 'var(--color-red)' : 'var(--chalk-dim)',
            }}
          >
            {p.profit > 0 ? '+' : ''}{fmt(p.profit)}
          </span>
          <span className="text-right" style={{ color: 'var(--chalk-dim)' }}>
            {p.wins}-{p.losses}
          </span>
          <span className="text-right" style={{ color: 'var(--chalk-dim)' }}>
            {fmt(p.volume)}
          </span>
        </div>
      ))}
      {players.length === 0 && (
        <div className="px-3 py-4 text-center text-sm" style={{ color: 'var(--chalk-ghost)' }}>
          No data yet
        </div>
      )}
    </div>
  );
}

function fmt(n: number): string {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}
