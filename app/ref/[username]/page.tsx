'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useUser } from '@/hooks/useUser';

export default function ReferralPage() {
  const { username } = useParams<{ username: string }>();
  const { login, authenticated, ready } = useUser();
  const decodedName = decodeURIComponent(username || '');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (decodedName) {
      localStorage.setItem('chalk_ref', decodedName);
      setSaved(true);
    }
  }, [decodedName]);

  // If already authenticated, redirect to home
  useEffect(() => {
    if (ready && authenticated) {
      window.location.href = '/';
    }
  }, [ready, authenticated]);

  if (!ready) return null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: 'var(--board-dark)' }}>
      {/* Scrolling emoji marquee */}
      <div className="w-full max-w-md overflow-hidden mb-4 rounded-[4px]" style={{ background: 'rgba(245,217,96,0.06)' }}>
        <div className="flex whitespace-nowrap animate-marquee py-2 text-lg">
          {Array(3).fill('🏀 🎯 ⚖️ 🤝 📺 🔥 💰 ').map((s, i) => (
            <span key={i} className="mx-2">{s}</span>
          ))}
        </div>
      </div>
      <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.33%); }
        }
        .animate-marquee {
          animation: marquee 12s linear infinite;
          width: max-content;
        }
      `}</style>
      <div
        className="w-full max-w-md rounded-lg p-8 text-center"
        style={{
          background: 'rgba(22, 36, 22, 0.95)',
          border: '1px dashed rgba(245,217,96,0.2)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
        }}
      >
        {/* Referrer callout */}
        <div
          className="rounded-[4px] px-4 py-3 mb-6"
          style={{ background: 'rgba(245,217,96,0.06)', border: '1px dashed rgba(245,217,96,0.15)' }}
        >
          <p className="text-xs mb-1" style={{ color: 'var(--chalk-ghost)' }}>You were invited by</p>
          <p className="text-lg font-bold" style={{ color: 'var(--color-yellow)', fontFamily: 'var(--font-chalk-header)' }}>
            {decodedName}
          </p>
        </div>

        {/* App description */}
        <h1
          className="text-2xl font-bold mb-3"
          style={{ color: 'var(--chalk-white)', fontFamily: 'var(--font-chalk-header)' }}
        >
          Welcome to Chalk
        </h1>
        <p className="text-sm mb-6 leading-relaxed" style={{ color: 'var(--chalk-dim)' }}>
          The peer-to-peer player prop platform. Create your own props,
          set your own odds, and bet against other fans — no sportsbook,
          no house edge. Just you vs. another person.
          Oh, and we stream every game for free.
        </p>

        {/* Features */}
        <div className="grid grid-cols-1 gap-2.5 mb-6 text-left">
          {[
            { icon: '🎯', text: 'Create your own props — pick any player, any stat, any line' },
            { icon: '⚖️', text: 'Set your own odds — you\'re the bookmaker' },
            { icon: '🤝', text: 'Peer-to-peer — no house, no vig, bet directly against fans' },
            { icon: '📺', text: 'Free HD streams — watch the games live while you bet' },
          ].map((f, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-3 py-2 rounded-[4px] text-sm"
              style={{ background: 'rgba(232,228,217,0.03)' }}
            >
              <span className="text-base">{f.icon}</span>
              <span style={{ color: 'var(--chalk-dim)' }}>{f.text}</span>
            </div>
          ))}
        </div>

        {/* CTA button */}
        <button
          onClick={login}
          className="w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-[4px] text-base font-bold transition-all duration-200 hover:brightness-125 cursor-pointer mb-4"
          style={{
            background: 'rgba(245,217,96,0.15)',
            border: '1px dashed rgba(245,217,96,0.4)',
            color: 'var(--color-yellow)',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Create Account
        </button>

      </div>
    </div>
  );
}
