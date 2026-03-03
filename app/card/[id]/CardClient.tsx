'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

interface ChalkCard {
  id: string;
  userId: string;
  userName: string;
  betId: string;
  player: string;
  stat: string;
  target: number;
  direction: string;
  result?: string;
  gameTitle?: string;
  format: string;
  duration: number;
  url: string;
  createdAt: number;
}

const STAT_LABELS: Record<string, string> = { points: 'PTS', rebounds: 'REB', assists: 'AST', threes: '3PM' };

export default function CardClient({ id }: { id: string }) {
  const [card, setCard] = useState<ChalkCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/chalk-cards');
        if (res.ok) {
          const data = await res.json();
          const found = (data.cards ?? []).find((c: ChalkCard) => c.id === id);
          if (found) setCard(found);
          else setError(true);
        } else {
          setError(true);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) { video.play().catch(() => {}); setPlaying(true); }
    else { video.pause(); setPlaying(false); }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 pt-10">
        <div className="aspect-[9/16] max-h-[70vh] mx-auto rounded-[4px] shimmer mb-4" />
        <div className="h-8 w-48 rounded-[4px] shimmer" />
      </div>
    );
  }

  if (error || !card) {
    return (
      <div className="max-w-3xl mx-auto px-4 pt-20 text-center fade-up">
        <div className="w-16 h-16 mx-auto mb-4 rounded-[4px] flex items-center justify-center" style={{ background: 'var(--dust-light)' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--chalk-ghost)" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M9 9h6v6H9z" />
          </svg>
        </div>
        <p className="text-sm" style={{ color: 'var(--chalk-dim)', fontFamily: 'var(--font-chalk-body)' }}>
          Chalk card not found
        </p>
        <Link href="/" className="text-xs mt-2 inline-block" style={{ color: 'var(--color-yellow)' }}>
          Back to games
        </Link>
      </div>
    );
  }

  const statLabel = STAT_LABELS[card.stat] || card.stat;
  const dirColor = card.direction === 'over' ? 'var(--color-green)' : 'var(--color-red)';
  const aspectClass = card.format === 'story' ? 'aspect-[9/16]' : card.format === 'square' ? 'aspect-square' : 'aspect-video';

  return (
    <div className="max-w-3xl mx-auto px-4 pt-6 pb-20 fade-up">
      {/* Video player */}
      <div className={`${aspectClass} max-h-[70vh] mx-auto bg-black rounded-[4px] overflow-hidden relative cursor-pointer mb-4`} onClick={togglePlay}>
        <video
          ref={videoRef}
          src={card.url}
          playsInline
          preload="auto"
          className="w-full h-full object-contain"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
        />
        {!playing && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', border: '1px dashed var(--dust-medium)' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="var(--chalk-white)" className="ml-1">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="chalk-card rounded-[4px] p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg chalk-header" style={{ color: 'var(--chalk-white)' }}>{card.player}</span>
          <span className="px-1.5 py-px rounded-[3px] text-[10px] chalk-header tracking-wide" style={{ background: `${dirColor}15`, color: dirColor, border: `1px dashed ${dirColor}30` }}>
            {card.direction.toUpperCase()}
          </span>
          <span className="text-lg tabular-nums chalk-score" style={{ color: 'var(--chalk-white)' }}>{card.target}</span>
          <span className="text-xs" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>{statLabel}</span>
        </div>

        {card.gameTitle && (
          <div className="text-xs mb-2" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>{card.gameTitle}</div>
        )}

        <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
          <span>By <span style={{ color: 'var(--chalk-dim)' }}>{card.userName}</span></span>
          <span style={{ opacity: 0.3 }}>|</span>
          <span className="tabular-nums">{new Date(card.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
        </div>

        <div className="mt-4 pt-3 chalk-stroke-top flex items-center gap-2">
          <button
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              const btn = document.getElementById('copy-card-btn');
              if (btn) { btn.textContent = 'Copied!'; setTimeout(() => { btn.textContent = 'Copy Link'; }, 1500); }
            }}
            id="copy-card-btn"
            className="chalk-btn chalk-btn-accent px-4 py-2 rounded-[4px] text-xs chalk-header cursor-pointer"
          >
            Copy Link
          </button>
        </div>
      </div>

      <div className="mt-4 text-center">
        <Link href="/" className="text-xs" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
          Back to games
        </Link>
      </div>
    </div>
  );
}
