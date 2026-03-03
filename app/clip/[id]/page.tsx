'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

interface Clip {
  id: string;
  userId: string;
  userName: string;
  gameId: string;
  gameTitle: string;
  sport: string;
  duration: number;
  url: string;
  createdAt: number;
}

import { use } from 'react';

export default function ClipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [clip, setClip] = useState<Clip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        // Fetch from our clips API and find by id
        const res = await fetch(`/api/clips`);
        if (res.ok) {
          const data = await res.json();
          const found = (data.clips ?? []).find((c: Clip) => c.id === id);
          if (found) {
            setClip(found);
          } else {
            setError(true);
          }
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
    if (video.paused) {
      video.play().catch(() => {});
      setPlaying(true);
    } else {
      video.pause();
      setPlaying(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 pt-10">
        <div className="aspect-video rounded-[4px] shimmer mb-4" />
        <div className="h-8 w-48 rounded-[4px] shimmer" />
      </div>
    );
  }

  if (error || !clip) {
    return (
      <div className="max-w-2xl mx-auto px-4 pt-20 text-center fade-up">
        <div
          className="w-16 h-16 mx-auto mb-4 rounded-[4px] flex items-center justify-center"
          style={{ background: 'var(--dust-light)' }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--chalk-ghost)" strokeWidth="2">
            <circle cx="6" cy="6" r="3" />
            <circle cx="6" cy="18" r="3" />
            <line x1="20" y1="4" x2="8.12" y2="15.88" />
            <line x1="14.47" y1="14.48" x2="20" y2="20" />
            <line x1="8.12" y1="8.12" x2="12" y2="12" />
          </svg>
        </div>
        <p className="text-sm" style={{ color: 'var(--chalk-dim)', fontFamily: 'var(--font-chalk-body)' }}>
          Clip not found
        </p>
        <Link href="/clips" className="text-xs mt-2 inline-block" style={{ color: 'var(--color-yellow)' }}>
          Browse all clips
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-20 fade-up">
      {/* Video player */}
      <div
        className="aspect-video bg-black rounded-[4px] overflow-hidden relative cursor-pointer mb-4"
        onClick={togglePlay}
      >
        <video
          ref={videoRef}
          src={clip.url}
          playsInline
          preload="auto"
          className="w-full h-full object-contain"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
        />

        {/* Play overlay */}
        {!playing && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', border: '1px dashed var(--dust-medium)' }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="var(--chalk-white)" className="ml-1">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        )}

        {/* Duration */}
        <div
          className="absolute bottom-3 right-3 px-2 py-1 rounded-[3px] text-xs tabular-nums chalk-header"
          style={{ background: 'rgba(0,0,0,0.7)', color: 'var(--chalk-white)' }}
        >
          {clip.duration}
        </div>
      </div>

      {/* Info */}
      <div className="chalk-card rounded-[4px] p-4">
        {clip.gameTitle && (
          <h1 className="text-lg chalk-header mb-2" style={{ color: 'var(--chalk-white)' }}>
            {clip.gameTitle}
          </h1>
        )}

        <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
          <span>Clipped by <span style={{ color: 'var(--chalk-dim)' }}>{clip.userName}</span></span>
          <span style={{ opacity: 0.3 }}>|</span>
          <span className="tabular-nums">{new Date(clip.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          <span style={{ opacity: 0.3 }}>|</span>
          <span>{clip.duration} clip</span>
        </div>

        {/* Share / Copy link */}
        <div className="mt-4 pt-3 chalk-stroke-top">
          <button
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              // Brief feedback
              const btn = document.getElementById('copy-btn');
              if (btn) { btn.textContent = 'Copied!'; setTimeout(() => { btn.textContent = 'Copy Link'; }, 1500); }
            }}
            id="copy-btn"
            className="chalk-btn chalk-btn-accent px-4 py-2 rounded-[4px] text-xs chalk-header cursor-pointer"
          >
            Copy Link
          </button>
        </div>
      </div>

      <div className="mt-4 text-center">
        <Link href="/clips" className="text-xs" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
          Browse all clips
        </Link>
      </div>
    </div>
  );
}
