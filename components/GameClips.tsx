'use client';

import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';

interface Clip {
  id: string;
  gameId: string;
  userName: string;
  gameTitle: string;
  duration: number;
  url: string;
  createdAt: number;
}

export function GameClips({ gameId }: { gameId: string }) {
  const [clips, setClips] = useState<Clip[]>([]);
  const [activeClip, setActiveClip] = useState<Clip | null>(null);

  useEffect(() => {
    async function load() {
      try {
        let res = await fetch(`/api/clips?gameId=${gameId}`);
        if (!res.ok) {
          res = await fetch('/api/clips');
        }
        if (res.ok) {
          const data = await res.json();
          const all: Clip[] = data.clips ?? [];
          setClips(all.filter((c) => c.gameId === gameId));
        }
      } catch { /* silent */ }
    }
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [gameId]);

  if (clips.length === 0) return null;

  return (
    <div className="flex-1 min-w-0">
      <div className="section-label mb-2.5">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--chalk-ghost)' }}>
          <circle cx="6" cy="6" r="3" />
          <circle cx="6" cy="18" r="3" />
          <line x1="20" y1="4" x2="8.12" y2="15.88" />
          <line x1="14.47" y1="14.48" x2="20" y2="20" />
          <line x1="8.12" y1="8.12" x2="12" y2="12" />
        </svg>
        Clips
      </div>
      <div className="flex gap-2.5 flex-wrap">
        {clips.map((clip) => (
          <ClipThumb key={clip.id} clip={clip} onClick={() => setActiveClip(clip)} />
        ))}
      </div>

      {activeClip && createPortal(
        <ClipModal clip={activeClip} onClose={() => setActiveClip(null)} />,
        document.body
      )}
    </div>
  );
}

function ClipThumb({ clip, onClick }: { clip: Clip; onClick: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hovering, setHovering] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (hovering) {
      video.currentTime = 0;
      video.play().catch(() => {});
    } else {
      video.pause();
      video.currentTime = 0;
    }
  }, [hovering]);

  return (
    <button
      onClick={onClick}
      className="block relative rounded-[4px] overflow-hidden cursor-pointer"
      style={{ width: 180, aspectRatio: '16/9', background: 'black' }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <video
        ref={videoRef}
        src={clip.url}
        muted
        playsInline
        preload="metadata"
        className="w-full h-full object-cover"
      />

      {!hovering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.5)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--chalk-white)" className="ml-0.5">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      )}

      {/* Duration */}
      <div
        className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded-[2px] text-[10px] tabular-nums chalk-header"
        style={{ background: 'rgba(0,0,0,0.7)', color: 'var(--chalk-white)' }}
      >
        {clip.duration}
      </div>

      {/* Username */}
      <div
        className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-[2px] text-[10px] truncate max-w-[100px]"
        style={{ background: 'rgba(0,0,0,0.5)', color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}
      >
        {clip.userName}
      </div>
    </button>
  );
}

function ClipModal({ clip, onClose }: { clip: Clip; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(true);

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-[4px] overflow-hidden fade-up"
        style={{ background: 'var(--board-dark)', border: '1px dashed var(--dust-medium)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Video */}
        <div className="aspect-video bg-black relative cursor-pointer" onClick={togglePlay}>
          <video
            ref={videoRef}
            src={clip.url}
            autoPlay
            playsInline
            className="w-full h-full object-contain"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
          />

          {!playing && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', border: '1px dashed var(--dust-medium)' }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="var(--chalk-white)" className="ml-1">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* Info bar */}
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs min-w-0" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
            <span className="truncate">
              Clipped by <span style={{ color: 'var(--chalk-dim)' }}>{clip.userName}</span>
            </span>
            <span style={{ opacity: 0.3 }}>|</span>
            <span className="tabular-nums flex-shrink-0">{clip.duration}</span>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/clip/${clip.id}`);
                const el = document.getElementById('clip-modal-copy');
                if (el) { el.textContent = 'Copied!'; setTimeout(() => { el.textContent = 'Copy Link'; }, 1500); }
              }}
              id="clip-modal-copy"
              className="px-3 py-1.5 rounded-[4px] text-[11px] chalk-header cursor-pointer transition-all"
              style={{ background: 'rgba(245,217,96,0.1)', border: '1px dashed rgba(245,217,96,0.2)', color: 'var(--color-yellow)' }}
            >
              Copy Link
            </button>
            <Link
              href={`/clip/${clip.id}`}
              className="px-3 py-1.5 rounded-[4px] text-[11px] chalk-header transition-all"
              style={{ background: 'rgba(232,228,217,0.06)', border: '1px dashed rgba(232,228,217,0.15)', color: 'var(--chalk-ghost)' }}
            >
              Full Page
            </Link>
            <button
              onClick={onClose}
              className="p-1.5 rounded-[4px] cursor-pointer"
              style={{ color: 'var(--chalk-ghost)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
