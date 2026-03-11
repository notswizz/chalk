'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useUser } from '@/hooks/useUser';
import { useToast } from '@/components/ToastProvider';
import {
  DAILY_CHALLENGES,
  STREAK_REWARDS,
  ACHIEVEMENTS,
  MILESTONES,
  getResetCountdown,
  type UserChallenges,
  type DailyChallenge,
} from '@/lib/challenges';

function getDailyProgress(challenge: DailyChallenge, data: UserChallenges): number {
  switch (challenge.id) {
    case 'daily_login': return data.daily.loggedIn ? 1 : 0;
    case 'first_chalk': return Math.min(data.daily.betsPlaced, 1);
    case 'double_down': return Math.min(data.daily.betsPlaced, 2);
    case 'board_regular': return Math.min(data.daily.betsPlaced, 3);
    case 'chalk_talk': return Math.min(data.daily.chatMessages, 5);
    case 'clip_artist': return Math.min(data.daily.clipsCreated, 1);
    case 'share_board': return Math.min(data.daily.cardsShared, 1);
    default: return 0;
  }
}

function getAchievementProgress(id: string, data: UserChallenges): { current: number; target: number } | null {
  const map: Record<string, [number, number]> = {
    first_blood: [data.totalWins, 1],
    cashed: [data.totalWins, 10],
    erased: [data.totalLosses, 10],
    hot_hand: [data.currentWinStreak, 3],
    on_fire: [data.currentWinStreak, 5],
    untouchable: [data.currentWinStreak, 10],
    degen: [data.totalBetsPlaced, 50],
    whale: [data.maxSingleBet, 500],
    social_butterfly: [data.totalChatMessages, 100],
    clipmaster: [data.totalClipsCreated, 10],
    high_roller: [data.totalProfit, 1000],
    the_oracle: [data.totalWins, 50],
  };
  const entry = map[id];
  if (!entry) return null;
  return { current: entry[0], target: entry[1] };
}

const RAINBOW = 'linear-gradient(90deg, #e85d5d, #f5d960, #5de88a, #5db8e8, #b05de8)';
const RAINBOW_SOFT = 'linear-gradient(90deg, rgba(232,93,93,0.15), rgba(245,217,96,0.15), rgba(93,232,138,0.15), rgba(93,184,232,0.15), rgba(176,93,232,0.15))';

export default function ChallengesPage() {
  const { authenticated, ready, getAccessToken, login } = useUser();
  const { showToast } = useToast();
  const [data, setData] = useState<UserChallenges | null>(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(getResetCountdown());
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [expandedChallenge, setExpandedChallenge] = useState<string | null>(null);
  const hasShownLoginToasts = useRef(false);

  const fetchData = useCallback(async () => {
    if (!ready) return;
    if (!authenticated) { setLoading(false); return; }
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/challenges', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const json = await res.json();
      if (res.ok) {
        setData(json.challenges ?? json);
        if (!hasShownLoginToasts.current && json.newRewards?.length > 0) {
          hasShownLoginToasts.current = true;
          for (const r of json.newRewards) {
            showToast({ id: `login-${r.id}-${Date.now()}`, title: r.label || r.id, subtitle: 'Login streak reward!', reward: r.reward, type: 'streak' });
          }
        }
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [authenticated, ready, getAccessToken, showToast]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const interval = setInterval(() => setCountdown(getResetCountdown()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const handleClaim = async (challengeId: string) => {
    if (!authenticated || claimingId) return;
    setClaimingId(challengeId);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/challenges/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ challengeId }),
      });
      if (res.ok) {
        const json = await res.json();
        const challenge = DAILY_CHALLENGES.find((c) => c.id === challengeId);
        showToast({ id: `claim-${challengeId}-${Date.now()}`, title: challenge?.name || 'Challenge Complete!', subtitle: challenge?.description, reward: json.reward, type: 'daily' });
        await fetchData();
      }
    } catch { /* silent */ }
    finally { setClaimingId(null); }
  };

  // ─── Login Prompt ───
  if (ready && !authenticated) {
    return (
      <div className="pinned-header-layout max-w-3xl mx-auto px-4">
        <div className="pinned-header pt-8 pb-4">
          <RainbowTitle />
        </div>
        <div className="pinned-scroll scrollbar-hide">
          <div className="flex flex-col items-center justify-center py-20 rounded-[8px] fade-up" style={{ background: RAINBOW_SOFT, border: '1.5px dashed rgba(232,228,217,0.1)' }}>
            <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4" style={{ background: 'rgba(245,217,96,0.1)', border: '2px dashed rgba(245,217,96,0.2)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-yellow)" strokeWidth="1.5"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            </div>
            <p className="text-sm font-bold" style={{ color: 'var(--chalk-white)', fontFamily: 'var(--font-chalk-header)' }}>Join Season 0</p>
            <p className="text-xs mt-1 mb-5 text-center max-w-[240px]" style={{ color: 'var(--chalk-ghost)' }}>Complete challenges, build streaks, and earn points that convert to tokens</p>
            <button
              onClick={() => login()}
              className="relative px-6 py-2.5 rounded-[6px] text-[12px] font-bold cursor-pointer transition-all duration-200 hover:scale-[1.04] active:scale-[0.96] overflow-hidden"
              style={{ background: 'transparent', color: 'var(--chalk-white)', fontFamily: 'var(--font-chalk-header)' }}
            >
              <div className="absolute inset-0 rounded-[6px]" style={{ background: RAINBOW, opacity: 0.2 }} />
              <div className="absolute inset-[1.5px] rounded-[5px]" style={{ background: 'var(--board-dark)' }} />
              <span className="relative z-10">Log In</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Loading ───
  if (loading) {
    return (
      <div className="pinned-header-layout max-w-3xl mx-auto px-4">
        <div className="pinned-header pt-8 pb-4"><RainbowTitle /></div>
        <div className="pinned-scroll scrollbar-hide">
          <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="shimmer rounded-[6px] h-[56px]" />)}</div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="pinned-header-layout max-w-3xl mx-auto px-4">
        <div className="pinned-header pt-8 pb-4"><RainbowTitle /></div>
        <div className="pinned-scroll scrollbar-hide">
          <p className="text-sm text-center py-12" style={{ color: 'var(--chalk-ghost)' }}>Failed to load. Try refreshing.</p>
        </div>
      </div>
    );
  }

  const streakNum = data.loginStreak ?? 0;
  const totalPts = data.challengePoints ?? data.totalChallengeEarnings ?? 0;
  const claimedCount = data.daily.claimed.length;
  const totalDaily = DAILY_CHALLENGES.length;
  const achievedCount = data.achievements.length;

  return (
    <div className="pinned-header-layout max-w-3xl mx-auto px-4">
      {/* ─── Header ─── */}
      <div className="pinned-header pt-6 pb-3">
        <div className="flex items-center justify-between mb-3">
          <RainbowTitle />
          <div className="flex items-center gap-2">
            {/* Points badge */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px]" style={{ background: 'rgba(245,217,96,0.08)', border: '1px solid rgba(245,217,96,0.15)' }}>
              <span className="text-[13px] font-extrabold tabular-nums" style={{ background: RAINBOW, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', fontFamily: 'var(--font-chalk-header)' }}>
                {totalPts.toLocaleString()}
              </span>
              <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--chalk-ghost)' }}>pts</span>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-2">
          <StatPill icon={<FireIcon />} value={`${streakNum}d`} label="streak" active={streakNum > 0} color="var(--color-orange)" />
          <StatPill icon={<CheckIcon />} value={`${claimedCount}/${totalDaily}`} label="today" active={claimedCount > 0} color="var(--color-green)" />
          <StatPill icon={<TrophyIcon />} value={`${achievedCount}`} label="badges" active={achievedCount > 0} color="var(--color-yellow)" />
          <div className="ml-auto flex items-center gap-1 px-2 py-1 rounded-[4px]" style={{ background: 'rgba(232,228,217,0.03)' }}>
            <ClockIcon />
            <span className="text-[10px] font-bold tabular-nums" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
              {countdown.hours}h {countdown.minutes}m
            </span>
          </div>
        </div>
      </div>

      {/* ─── Content ─── */}
      <div className="pinned-scroll scrollbar-hide">

        {/* ═══ TODAY ═══ */}
        <section className="fade-up mb-5">
          <SectionHeader title="TODAY" subtitle={`${claimedCount}/${totalDaily} complete`} />
          <div className="rounded-[8px] overflow-hidden" style={{ border: '1.5px solid rgba(232,228,217,0.06)' }}>
            {DAILY_CHALLENGES.map((challenge, idx) => {
              const progress = getDailyProgress(challenge, data);
              const met = progress >= challenge.requirement;
              const claimed = data.daily.claimed.includes(challenge.id);
              const pct = Math.min((progress / challenge.requirement) * 100, 100);
              const isExpanded = expandedChallenge === challenge.id;

              return (
                <div
                  key={challenge.id}
                  style={{
                    borderBottom: idx < DAILY_CHALLENGES.length - 1 ? '1px solid rgba(232,228,217,0.04)' : 'none',
                    padding: '10px 14px',
                    background: claimed ? 'rgba(93,232,138,0.02)' : met ? 'rgba(245,217,96,0.02)' : 'rgba(30,46,30,0.6)',
                    transition: 'background 0.2s',
                  }}
                >
                  <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedChallenge(isExpanded ? null : challenge.id)}>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {/* Status dot */}
                      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{
                        background: claimed ? 'rgba(93,232,138,0.15)' : met ? 'rgba(245,217,96,0.12)' : 'rgba(232,228,217,0.04)',
                        border: `1.5px ${claimed || met ? 'solid' : 'dashed'} ${claimed ? 'rgba(93,232,138,0.4)' : met ? 'rgba(245,217,96,0.3)' : 'rgba(232,228,217,0.1)'}`,
                      }}>
                        {claimed ? (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--color-green)" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
                        ) : met ? (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="var(--color-yellow)"><circle cx="12" cy="12" r="4" /></svg>
                        ) : (
                          <span className="text-[8px] font-bold tabular-nums" style={{ color: 'var(--chalk-ghost)' }}>{progress}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="text-[12px] font-bold block" style={{
                          color: claimed ? 'var(--chalk-ghost)' : met ? 'var(--color-yellow)' : 'var(--chalk-white)',
                          fontFamily: 'var(--font-chalk-body)',
                          textDecoration: claimed ? 'line-through' : 'none',
                        }}>
                          {challenge.name}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[11px] font-bold tabular-nums" style={{
                        color: claimed ? 'var(--chalk-ghost)' : 'var(--color-yellow)',
                        fontFamily: 'var(--font-chalk-header)',
                      }}>
                        +{challenge.reward}
                      </span>
                      {claimed ? (
                        <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-[3px] uppercase tracking-wider" style={{ background: 'rgba(93,232,138,0.08)', color: 'var(--color-green)' }}>Done</span>
                      ) : met ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleClaim(challenge.id); }}
                          disabled={claimingId === challenge.id}
                          className="text-[9px] font-bold px-3 py-1 rounded-[4px] cursor-pointer transition-all duration-200 hover:scale-[1.06] active:scale-[0.94]"
                          style={{
                            background: RAINBOW,
                            color: 'var(--board-dark)',
                            fontFamily: 'var(--font-chalk-header)',
                            boxShadow: '0 0 16px rgba(245,217,96,0.3)',
                          }}
                        >
                          {claimingId === challenge.id ? '...' : 'CLAIM'}
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {isExpanded && (
                    <p className="text-[11px] mt-1.5 ml-7" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)', lineHeight: 1.4 }}>
                      {challenge.description}
                    </p>
                  )}

                  {/* Progress bar */}
                  <div className="mt-2 ml-7" style={{ height: 3, borderRadius: 2, background: 'rgba(232,228,217,0.06)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${pct}%`, borderRadius: 2, transition: 'width 0.4s ease',
                      background: claimed ? 'rgba(93,232,138,0.3)' : met ? RAINBOW : 'linear-gradient(90deg, rgba(93,232,138,0.4), rgba(93,232,138,0.2))',
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ═══ STREAKS ═══ */}
        <section className="fade-up mb-5">
          <SectionHeader title="STREAK" subtitle={streakNum > 0 ? `${streakNum} days strong` : 'Start logging in daily'} />
          <div className="rounded-[8px] p-4" style={{ background: 'rgba(30,46,30,0.6)', border: '1.5px solid rgba(232,228,217,0.06)' }}>
            {/* Big streak number */}
            <div className="text-center mb-5">
              <div className="inline-flex items-baseline gap-1">
                <span className="text-[42px] font-extrabold tabular-nums" style={{
                  fontFamily: 'var(--font-chalk-header)',
                  background: streakNum > 0 ? RAINBOW : 'var(--chalk-ghost)',
                  WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
                  filter: streakNum > 0 ? 'drop-shadow(0 0 12px rgba(245,217,96,0.3))' : 'none',
                }}>
                  {streakNum}
                </span>
                <span className="text-[14px] font-bold" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>days</span>
              </div>
            </div>

            {/* Timeline */}
            <div className="flex items-center justify-between relative">
              {/* Connecting line */}
              <div className="absolute top-[18px] left-[24px] right-[24px] h-[2px]" style={{ background: 'rgba(232,228,217,0.06)' }} />
              <div className="absolute top-[18px] left-[24px] h-[2px]" style={{
                background: RAINBOW, opacity: 0.6,
                width: (() => {
                  const maxDays = STREAK_REWARDS[STREAK_REWARDS.length - 1].days;
                  return `${Math.min((streakNum / maxDays) * 100, 100)}%`;
                })(),
                transition: 'width 0.5s ease',
              }} />

              {STREAK_REWARDS.map((sr) => {
                const achieved = streakNum >= sr.days;
                const isNext = !achieved && STREAK_REWARDS.every((o) => o.days >= sr.days || streakNum >= o.days);

                return (
                  <div key={sr.days} className="flex flex-col items-center gap-2 relative z-10">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold transition-all duration-300" style={{
                      background: achieved ? RAINBOW_SOFT : isNext ? 'rgba(245,217,96,0.08)' : 'rgba(30,46,30,0.9)',
                      border: `2px ${achieved ? 'solid' : 'dashed'} ${achieved ? 'rgba(93,232,138,0.5)' : isNext ? 'rgba(245,217,96,0.3)' : 'rgba(232,228,217,0.1)'}`,
                      color: achieved ? 'var(--color-green)' : isNext ? 'var(--color-yellow)' : 'var(--chalk-ghost)',
                      fontFamily: 'var(--font-chalk-header)',
                      boxShadow: achieved ? '0 0 16px rgba(93,232,138,0.2)' : isNext ? '0 0 12px rgba(245,217,96,0.1)' : 'none',
                    }}>
                      {achieved ? '\u2713' : sr.days}
                    </div>
                    <div className="text-center">
                      <span className="text-[9px] font-bold block" style={{ color: achieved ? 'var(--color-green)' : isNext ? 'var(--color-yellow)' : 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-header)' }}>
                        {sr.label}
                      </span>
                      <span className="text-[9px] font-bold" style={{ color: 'var(--chalk-ghost)' }}>+{sr.reward}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ═══ ACHIEVEMENTS ═══ */}
        <section className="fade-up mb-5">
          <SectionHeader title="ACHIEVEMENTS" subtitle={`${achievedCount}/${ACHIEVEMENTS.length} unlocked`} />
          <div className="grid grid-cols-2 gap-2">
            {ACHIEVEMENTS.map((ach) => {
              const unlocked = data.achievements.includes(ach.id);
              const prog = !unlocked ? getAchievementProgress(ach.id, data) : null;
              const pct = prog ? Math.min((prog.current / prog.target) * 100, 100) : 0;

              return (
                <div key={ach.id} className="rounded-[8px] p-3 transition-all duration-200" style={{
                  background: unlocked ? 'rgba(30,46,30,0.8)' : 'rgba(30,46,30,0.4)',
                  border: `1.5px ${unlocked ? 'solid' : 'dashed'} ${unlocked ? 'rgba(93,232,138,0.25)' : 'rgba(232,228,217,0.06)'}`,
                  opacity: unlocked ? 1 : 0.7,
                }}>
                  <div className="flex items-start justify-between mb-1.5">
                    <div className="w-7 h-7 rounded-[6px] flex items-center justify-center" style={{
                      background: unlocked ? RAINBOW_SOFT : 'rgba(232,228,217,0.03)',
                    }}>
                      {unlocked ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 2L14.9 8.6L22 9.3L16.5 14L18 21L12 17.5L6 21L7.5 14L2 9.3L9.1 8.6L12 2Z" fill="var(--color-yellow)" /></svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--chalk-ghost)" strokeWidth="1.5"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                      )}
                    </div>
                    <span className="text-[10px] font-bold tabular-nums" style={{
                      background: unlocked ? RAINBOW : 'none',
                      WebkitBackgroundClip: unlocked ? 'text' : undefined,
                      backgroundClip: unlocked ? 'text' : undefined,
                      color: unlocked ? 'transparent' : 'var(--chalk-ghost)',
                      fontFamily: 'var(--font-chalk-header)',
                    }}>
                      +{ach.reward}
                    </span>
                  </div>
                  <p className="text-[11px] font-bold" style={{ color: unlocked ? 'var(--chalk-white)' : 'var(--chalk-dim)', fontFamily: 'var(--font-chalk-header)' }}>
                    {ach.name}
                  </p>
                  <p className="text-[9px] mt-0.5 leading-snug" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
                    {ach.description}
                  </p>
                  {/* Progress bar for locked */}
                  {!unlocked && prog && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[8px] font-bold tabular-nums" style={{ color: 'var(--chalk-ghost)' }}>{prog.current}/{prog.target}</span>
                      </div>
                      <div style={{ height: 3, borderRadius: 2, background: 'rgba(232,228,217,0.06)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, borderRadius: 2, background: 'linear-gradient(90deg, rgba(176,93,232,0.5), rgba(93,184,232,0.5))', transition: 'width 0.4s ease' }} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ═══ MILESTONES ═══ */}
        <section className="fade-up mb-8">
          <SectionHeader title="MILESTONES" subtitle="Lifetime stats" />
          <div className="rounded-[8px] overflow-hidden" style={{ border: '1.5px solid rgba(232,228,217,0.06)' }}>
            {MILESTONES.map((ms, idx) => {
              const current = (data as unknown as Record<string, number>)[ms.stat] ?? 0;
              const completed = current >= ms.target;
              const pct = Math.min((current / ms.target) * 100, 100);

              return (
                <div key={ms.id} style={{
                  borderBottom: idx < MILESTONES.length - 1 ? '1px solid rgba(232,228,217,0.04)' : 'none',
                  padding: '10px 14px',
                  background: completed ? 'rgba(93,232,138,0.02)' : 'rgba(30,46,30,0.6)',
                }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{
                        background: completed ? 'rgba(93,232,138,0.15)' : 'rgba(232,228,217,0.04)',
                        border: `1.5px ${completed ? 'solid' : 'dashed'} ${completed ? 'rgba(93,232,138,0.4)' : 'rgba(232,228,217,0.1)'}`,
                      }}>
                        {completed ? (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--color-green)" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
                        ) : (
                          <span className="text-[7px] font-bold" style={{ color: 'var(--chalk-ghost)' }}>{Math.round(pct)}%</span>
                        )}
                      </div>
                      <span className="text-[12px] font-bold" style={{ color: completed ? 'var(--color-green)' : 'var(--chalk-white)', fontFamily: 'var(--font-chalk-body)' }}>
                        {ms.name}
                      </span>
                      <span className="text-[10px] font-bold tabular-nums" style={{ color: 'var(--chalk-ghost)' }}>
                        {current.toLocaleString()}/{ms.target.toLocaleString()}
                      </span>
                    </div>
                    <span className="text-[11px] font-bold tabular-nums" style={{
                      color: completed ? 'var(--chalk-ghost)' : 'var(--color-yellow)',
                      fontFamily: 'var(--font-chalk-header)',
                    }}>+{ms.reward}</span>
                  </div>
                  <div className="ml-7" style={{ height: 3, borderRadius: 2, background: 'rgba(232,228,217,0.06)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${pct}%`, borderRadius: 2, transition: 'width 0.4s ease',
                      background: completed ? RAINBOW : 'linear-gradient(90deg, rgba(93,232,138,0.5), rgba(93,232,138,0.2))',
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

// ─── Shared Components ───

function RainbowTitle() {
  return (
    <h1 className="text-xl font-extrabold" style={{
      fontFamily: 'var(--font-chalk-header)',
      background: 'linear-gradient(90deg, #e85d5d, #f5d960, #5de88a, #5db8e8, #b05de8)',
      WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
      letterSpacing: '0.04em',
      filter: 'drop-shadow(0 0 8px rgba(245,217,96,0.15))',
    }}>
      Season 0
    </h1>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-center justify-between mb-2.5">
      <div className="flex items-center gap-2">
        <div style={{ width: 3, height: 14, borderRadius: 2, background: RAINBOW }} />
        <h2 className="text-[12px] font-bold tracking-[0.2em]" style={{ color: 'var(--chalk-dim)', fontFamily: 'var(--font-chalk-header)' }}>
          {title}
        </h2>
      </div>
      {subtitle && (
        <span className="text-[10px] font-bold" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
          {subtitle}
        </span>
      )}
    </div>
  );
}

function StatPill({ icon, value, label, active, color }: { icon: React.ReactNode; value: string; label: string; active: boolean; color: string }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[6px]" style={{
      background: active ? `${color}11` : 'rgba(232,228,217,0.03)',
      border: `1px ${active ? 'solid' : 'dashed'} ${active ? `${color}33` : 'rgba(232,228,217,0.06)'}`,
    }}>
      {icon}
      <span className="text-[11px] font-bold tabular-nums" style={{ color: active ? color : 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-header)' }}>{value}</span>
      <span className="text-[9px]" style={{ color: 'var(--chalk-ghost)' }}>{label}</span>
    </div>
  );
}

function FireIcon() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--color-orange)"><path d="M12 2C12 2 16 7 16 11C16 13.2 14.2 15 12 15C9.8 15 8 13.2 8 11C8 7 12 2 12 2Z" /></svg>; }
function CheckIcon() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-green)" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>; }
function TrophyIcon() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--color-yellow)"><path d="M12 2L14.4 7.6L20.5 8.3L16 12.5L17.1 18.5L12 15.5L6.9 18.5L8 12.5L3.5 8.3L9.6 7.6L12 2Z" /></svg>; }
function ClockIcon() { return <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--chalk-ghost)" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg>; }
