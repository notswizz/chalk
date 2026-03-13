'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useUser } from '@/hooks/useUser';

export const dynamic = 'force-dynamic';

interface Clip {
  id: string;
  clipTitle?: string;
  userId: string;
  userName: string;
  gameId: string;
  gameTitle: string;
  sport: string;
  duration: number;
  url: string;
  createdAt: number;
  upvotes?: number;
  downvotes?: number;
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const SPORT_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'nba', label: 'NBA' },
  { key: 'ncaam', label: 'NCAA' },
  { key: 'nfl', label: 'NFL' },
  { key: 'mlb', label: 'MLB' },
  { key: 'nhl', label: 'NHL' },
  { key: 'soccer', label: 'Soccer' },
];

const TIME_FILTERS = [
  { key: '', label: 'All Time' },
  { key: '1d', label: '24h' },
  { key: '1w', label: '1W' },
  { key: '1m', label: '1M' },
];

const SORT_OPTIONS = [
  { key: 'recent', label: 'Recent' },
  { key: 'upvotes', label: 'Top' },
];

export default function ClipsPage() {
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const [sportFilter, setSportFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState('');
  const [sort, setSort] = useState('recent');
  const [userVotes, setUserVotes] = useState<Record<string, string>>({});
  const { authenticated, getAccessToken } = useUser();

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (sort) params.set('sort', sort);
        if (timeFilter) params.set('time', timeFilter);
        const res = await fetch(`/api/clips?${params}`);
        if (res.ok) {
          const data = await res.json();
          setClips(data.clips ?? []);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [sort, timeFilter]);

  // Fetch user's votes
  useEffect(() => {
    if (!authenticated || clips.length === 0) return;
    async function loadVotes() {
      try {
        const token = await getAccessToken();
        const ids = clips.map((c) => c.id).join(',');
        const res = await fetch(`/api/clips/vote?clipIds=${ids}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          setUserVotes(data.votes ?? {});
        }
      } catch { /* silent */ }
    }
    loadVotes();
  }, [authenticated, clips]);

  async function handleVote(clipId: string, vote: 'up' | 'down') {
    if (!authenticated) return;
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/clips/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ clipId, vote }),
      });
      if (res.ok) {
        const data = await res.json();
        setUserVotes((prev) => {
          const next = { ...prev };
          if (data.vote) next[clipId] = data.vote;
          else delete next[clipId];
          return next;
        });
        // Update local clip counts
        setClips((prev) =>
          prev.map((c) => {
            if (c.id !== clipId) return c;
            const prevVote = userVotes[clipId];
            let up = c.upvotes ?? 0;
            let down = c.downvotes ?? 0;
            // Remove previous vote
            if (prevVote === 'up') up = Math.max(0, up - 1);
            if (prevVote === 'down') down = Math.max(0, down - 1);
            // Add new vote
            if (data.vote === 'up') up += 1;
            if (data.vote === 'down') down += 1;
            return { ...c, upvotes: up, downvotes: down };
          })
        );
      }
    } catch { /* silent */ }
  }

  const filtered = sportFilter === 'all' ? clips : clips.filter((c) => c.sport === sportFilter);
  const sportCounts = clips.reduce<Record<string, number>>((acc, c) => {
    acc[c.sport] = (acc[c.sport] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="pinned-header-layout max-w-5xl mx-auto px-4">
      {/* ─── Pinned Header ─── */}
      <div className="pinned-header pt-6 pb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="section-label">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--chalk-ghost)' }}>
                <circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" />
                <line x1="20" y1="4" x2="8.12" y2="15.88" /><line x1="14.47" y1="14.48" x2="20" y2="20" /><line x1="8.12" y1="8.12" x2="12" y2="12" />
              </svg>
              Clips
            </div>
            {!loading && clips.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-[4px] text-[9px] font-bold tabular-nums" style={{ background: 'rgba(245,217,96,0.08)', color: 'var(--color-yellow)' }}>
                {filtered.length}
              </span>
            )}
          </div>
        </div>

        {/* Sport filter pills */}
        {clips.length > 0 && (
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide pb-1">
            {SPORT_FILTERS.filter((s) => s.key === 'all' || sportCounts[s.key]).map((s) => {
              const active = sportFilter === s.key;
              const count = s.key === 'all' ? clips.length : (sportCounts[s.key] || 0);
              return (
                <button
                  key={s.key}
                  onClick={() => setSportFilter(s.key)}
                  className="flex-shrink-0 px-2.5 py-1 rounded-[4px] text-[10px] chalk-header tracking-wide cursor-pointer transition-all"
                  style={{
                    background: active ? 'rgba(245,217,96,0.12)' : 'rgba(232,228,217,0.04)',
                    border: active ? '1px dashed rgba(245,217,96,0.25)' : '1px dashed rgba(232,228,217,0.08)',
                    color: active ? 'var(--color-yellow)' : 'var(--chalk-ghost)',
                  }}
                >
                  {s.label}
                  <span className="ml-1 tabular-nums" style={{ opacity: 0.6 }}>{count}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Time filter + sort */}
        {clips.length > 0 && (
          <div className="flex items-center justify-between gap-2 mt-2">
            <div className="flex items-center gap-1">
              {TIME_FILTERS.map((t) => {
                const active = timeFilter === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTimeFilter(t.key)}
                    className="flex-shrink-0 px-2 py-0.5 rounded-[4px] text-[10px] chalk-header tracking-wide cursor-pointer transition-all"
                    style={{
                      background: active ? 'rgba(93,155,232,0.12)' : 'transparent',
                      border: active ? '1px dashed rgba(93,155,232,0.25)' : '1px dashed transparent',
                      color: active ? 'var(--color-blue)' : 'var(--chalk-ghost)',
                    }}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-1">
              {SORT_OPTIONS.map((s) => {
                const active = sort === s.key;
                return (
                  <button
                    key={s.key}
                    onClick={() => setSort(s.key)}
                    className="flex-shrink-0 px-2 py-0.5 rounded-[4px] text-[10px] chalk-header tracking-wide cursor-pointer transition-all"
                    style={{
                      background: active ? 'rgba(245,217,96,0.12)' : 'transparent',
                      border: active ? '1px dashed rgba(245,217,96,0.25)' : '1px dashed transparent',
                      color: active ? 'var(--color-yellow)' : 'var(--chalk-ghost)',
                    }}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ─── Scrollable Content ─── */}
      <div className="pinned-scroll scrollbar-hide">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="aspect-video rounded-[4px] shimmer" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div
              className="w-16 h-16 mx-auto mb-4 rounded-[4px] flex items-center justify-center"
              style={{ background: 'var(--dust-light)' }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--chalk-ghost)" strokeWidth="2">
                <circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" />
                <line x1="20" y1="4" x2="8.12" y2="15.88" /><line x1="14.47" y1="14.48" x2="20" y2="20" /><line x1="8.12" y1="8.12" x2="12" y2="12" />
              </svg>
            </div>
            <p className="text-sm" style={{ color: 'var(--chalk-dim)', fontFamily: 'var(--font-chalk-body)' }}>
              {sportFilter !== 'all' ? `No ${SPORT_FILTERS.find((s) => s.key === sportFilter)?.label} clips yet` : 'No clips yet'}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
              Watch a live game and hit the clip button to capture a highlight.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((clip, i) => (
              <ClipCard
                key={clip.id}
                clip={clip}
                index={i}
                userVote={userVotes[clip.id] || null}
                onVote={handleVote}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const TTS_VOICES = [
  { id: 'en-US-GuyNeural', label: 'Guy (US)' },
  { id: 'en-GB-RyanNeural', label: 'Ryan (UK)' },
  { id: 'en-US-AriaNeural', label: 'Aria (US)' },
  { id: 'en-AU-WilliamNeural', label: 'William (AU)' },
];

function ClipCard({ clip, index, userVote, onVote }: { clip: Clip; index: number; userVote: string | null; onVote: (clipId: string, vote: 'up' | 'down') => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const { authenticated } = useUser();
  const score = (clip.upvotes ?? 0) - (clip.downvotes ?? 0);

  function handleMouseEnter() {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    video.play().catch(() => {});
    setPlaying(true);
  }

  function handleMouseLeave() {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.currentTime = 0;
    setPlaying(false);
  }

  return (
    <>
      <div
        className="chalk-card rounded-[4px] overflow-hidden fade-up"
        style={{ animationDelay: `${Math.min(index * 50, 300)}ms`, opacity: 0 }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Video */}
        <div className="aspect-video bg-black relative">
          <video
            ref={videoRef}
            src={clip.url}
            playsInline
            muted
            preload="metadata"
            className="w-full h-full object-contain"
            onEnded={() => setPlaying(false)}
          />

          {!playing && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--chalk-white)" className="ml-0.5">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          )}

          <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
            {clip.sport && (
              <span className="px-1.5 py-0.5 rounded-[3px] text-[8px] chalk-header tracking-wider uppercase" style={{ background: 'rgba(245,217,96,0.15)', color: 'var(--color-yellow)' }}>
                {clip.sport}
              </span>
            )}
            <span className="px-1.5 py-0.5 rounded-[3px] text-[10px] tabular-nums chalk-header" style={{ background: 'rgba(0,0,0,0.7)', color: 'var(--chalk-white)' }}>
              {clip.duration}s
            </span>
          </div>
        </div>

        {/* Info */}
        <div className="px-3 py-2.5">
          {(clip.clipTitle || clip.gameTitle) && (
            <div className="text-xs chalk-header truncate mb-1" style={{ color: 'var(--chalk-white)' }}>
              {clip.clipTitle || clip.gameTitle}
            </div>
          )}
          {clip.clipTitle && clip.gameTitle && (
            <div className="flex items-center gap-1 mb-1">
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="var(--color-yellow)" strokeWidth="2.5">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
                <line x1="7" y1="7" x2="7.01" y2="7" />
              </svg>
              <span className="text-[9px]" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>{clip.gameTitle}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Vote buttons */}
              <div className="flex items-center gap-0.5">
                <button
                  onClick={(e) => { e.stopPropagation(); onVote(clip.id, 'up'); }}
                  className="p-1 rounded-[3px] cursor-pointer transition-all hover:scale-110"
                  style={{ color: userVote === 'up' ? 'var(--color-green)' : 'var(--chalk-ghost)', opacity: authenticated ? 1 : 0.4 }}
                  disabled={!authenticated}
                  title="Upvote"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill={userVote === 'up' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 4l-8 8h5v8h6v-8h5z" />
                  </svg>
                </button>
                <span className="text-[10px] tabular-nums min-w-[16px] text-center font-bold" style={{ color: score > 0 ? 'var(--color-green)' : score < 0 ? 'var(--color-red)' : 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
                  {score}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); onVote(clip.id, 'down'); }}
                  className="p-1 rounded-[3px] cursor-pointer transition-all hover:scale-110"
                  style={{ color: userVote === 'down' ? 'var(--color-red)' : 'var(--chalk-ghost)', opacity: authenticated ? 1 : 0.4 }}
                  disabled={!authenticated}
                  title="Downvote"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill={userVote === 'down' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 20l8-8h-5V4H9v8H4z" />
                  </svg>
                </button>
              </div>
              <span className="text-[10px]" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
                {clip.userName}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] tabular-nums" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
                {relativeTime(clip.createdAt)}
              </span>
              {authenticated && (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowShareModal(true); }}
                  className="chalk-btn px-2 py-1 rounded-[3px] text-[10px] chalk-header cursor-pointer flex items-center gap-1"
                  style={{ background: 'rgba(245,217,96,0.12)', border: '1px dashed rgba(245,217,96,0.25)', color: 'var(--color-yellow)' }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
                    <polyline points="16 6 12 2 8 6" />
                    <line x1="12" y1="2" x2="12" y2="15" />
                  </svg>
                  Share
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {showShareModal && (
        <ClipShareModal clip={clip} onClose={() => setShowShareModal(false)} />
      )}
    </>
  );
}

function ClipShareModal({ clip, onClose }: { clip: Clip; onClose: () => void }) {
  const { getAccessToken } = useUser();
  const defaultScript = clip.clipTitle || clip.gameTitle || '';
  const [ttsText, setTtsText] = useState(defaultScript);
  const [ttsVoice, setTtsVoice] = useState(TTS_VOICES[0].id);
  const [step, setStep] = useState<'edit' | 'generating' | 'ready'>('edit');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [copied, setCopied] = useState(false);
  const [canShareFiles, setCanShareFiles] = useState(false);

  useEffect(() => {
    // Check if Web Share API supports file sharing (mobile browsers / X app)
    if (typeof navigator !== 'undefined' && navigator.canShare) {
      const testFile = new File(['test'], 'test.mp4', { type: 'video/mp4' });
      setCanShareFiles(navigator.canShare({ files: [testFile] }));
    }
  }, []);

  async function handleGenerate() {
    if (!ttsText.trim()) { setError('Add a voiceover to share'); return; }
    if (ttsText.length > 280) { setError('Max 280 characters'); return; }

    setStep('generating');
    setError('');
    try {
      // 1. Generate TTS
      setProgress('Generating voiceover...');
      const token = await getAccessToken();
      const ttsRes = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ text: ttsText, voice: ttsVoice }),
      });
      if (!ttsRes.ok) {
        let errMsg = 'TTS failed';
        try { const data = await ttsRes.json(); errMsg = data.error || errMsg; } catch { /* */ }
        throw new Error(errMsg);
      }
      const audioBlob = await ttsRes.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      // 2. Fetch clip video through proxy to avoid CORS
      setProgress('Loading clip...');
      const proxyUrl = `/api/clips/proxy?url=${encodeURIComponent(clip.url)}`;
      const videoRes = await fetch(proxyUrl);
      if (!videoRes.ok) throw new Error('Failed to load clip video');
      const videoBlob = await videoRes.blob();
      const videoBlobUrl = URL.createObjectURL(videoBlob);

      // 3. Re-encode with TTS overlay
      setProgress('Encoding video with voiceover...');
      const reencoded = await reencodeWithTTS(videoBlobUrl, audioUrl);
      URL.revokeObjectURL(videoBlobUrl);
      URL.revokeObjectURL(audioUrl);

      const blobUrl = URL.createObjectURL(reencoded);
      setResultBlob(reencoded);
      setResultUrl(blobUrl);
      setStep('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate');
      setStep('edit');
    }
  }

  function handleDownload() {
    if (!resultBlob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(resultBlob);
    a.download = `chalk-clip-${clip.id}.mp4`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function handleCopyLink() {
    const clipUrl = `${window.location.origin}/clip/${clip.id}`;
    navigator.clipboard.writeText(clipUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function handleShareVideo() {
    if (!resultBlob) return;
    const file = new File([resultBlob], 'chalk-clip.mp4', { type: 'video/mp4' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: clip.clipTitle || clip.gameTitle || 'Chalk Clip',
          text: ttsText,
        });
      } catch {
        // User cancelled or share failed — no-op
      }
    } else {
      // Fallback: download the file
      handleDownload();
    }
  }

  function handleRedo() {
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setResultUrl(null);
    setResultBlob(null);
    setStep('edit');
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-[4px] fade-up"
        style={{ background: 'var(--board-dark)', border: '1px dashed var(--dust-medium)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 sticky top-0 z-10" style={{ background: 'var(--board-dark)', borderBottom: '1px dashed var(--dust-light)' }}>
          <span className="chalk-header text-base" style={{ color: 'var(--chalk-white)' }}>Share Clip</span>
          <button onClick={onClose} className="p-1 rounded-[4px] cursor-pointer" style={{ color: 'var(--chalk-ghost)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Preview */}
          <div className="rounded-[4px] overflow-hidden bg-black">
            {resultUrl ? (
              <video
                key="result"
                src={resultUrl}
                autoPlay
                loop
                controls
                playsInline
                className="w-full object-contain"
                style={{ maxHeight: '30vh' }}
              />
            ) : (
              <video
                key="original"
                src={clip.url}
                controls
                playsInline
                preload="metadata"
                className="w-full object-contain"
                style={{ maxHeight: '30vh' }}
              />
            )}
          </div>

          {/* Game tag */}
          {clip.gameTitle && (
            <div className="flex items-center gap-1.5">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--color-yellow)" strokeWidth="2.5">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
                <line x1="7" y1="7" x2="7.01" y2="7" />
              </svg>
              <span className="text-[10px] chalk-header" style={{ color: 'var(--color-yellow)' }}>{clip.gameTitle}</span>
            </div>
          )}

          {/* Step: Edit — voiceover input */}
          {step === 'edit' && (
            <>
              <div>
                <label className="block text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
                  Voiceover ({ttsText.length}/280)
                </label>
                <textarea
                  value={ttsText}
                  onChange={(e) => setTtsText(e.target.value.slice(0, 280))}
                  rows={3}
                  placeholder="Add your hot take..."
                  className="w-full px-3 py-2 rounded-[4px] text-sm resize-none"
                  style={{
                    background: 'rgba(232,228,217,0.04)',
                    border: '1px dashed rgba(232,228,217,0.1)',
                    color: 'var(--chalk-white)',
                    fontFamily: 'var(--font-chalk-body)',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
                  Voice
                </label>
                <select
                  value={ttsVoice}
                  onChange={(e) => setTtsVoice(e.target.value)}
                  className="w-full px-3 py-2 rounded-[4px] text-sm cursor-pointer"
                  style={{
                    background: 'rgba(232,228,217,0.04)',
                    border: '1px dashed rgba(232,228,217,0.1)',
                    color: 'var(--chalk-white)',
                    fontFamily: 'var(--font-chalk-body)',
                    outline: 'none',
                  }}
                >
                  {TTS_VOICES.map((v) => (
                    <option key={v.id} value={v.id} style={{ background: 'var(--board-dark)' }}>{v.label}</option>
                  ))}
                </select>
              </div>

              {error && (
                <p className="text-xs" style={{ color: 'var(--color-red)', fontFamily: 'var(--font-chalk-body)' }}>{error}</p>
              )}

              <button
                onClick={handleGenerate}
                className="w-full py-3 rounded-[4px] text-sm chalk-header tracking-wide cursor-pointer transition-all"
                style={{
                  background: 'rgba(245,217,96,0.12)',
                  border: '1.5px dashed rgba(245,217,96,0.3)',
                  color: 'var(--color-yellow)',
                }}
              >
                Generate with Voiceover
              </button>
            </>
          )}

          {/* Step: Generating — progress */}
          {step === 'generating' && (
            <div className="py-4 text-center space-y-3">
              <span className="inline-block w-5 h-5 rounded-full border-2 border-current border-t-transparent animate-spin" style={{ color: 'var(--color-yellow)' }} />
              <p className="text-xs chalk-header" style={{ color: 'var(--chalk-dim)' }}>{progress}</p>
            </div>
          )}

          {/* Step: Ready — share actions */}
          {step === 'ready' && (
            <div className="space-y-3">
              {/* Primary: Share video file (mobile) or Download (desktop) */}
              {canShareFiles ? (
                <button
                  onClick={handleShareVideo}
                  className="w-full py-3 rounded-[4px] text-sm chalk-header tracking-wide cursor-pointer transition-all flex items-center justify-center gap-2"
                  style={{ background: 'rgba(93,155,232,0.15)', border: '1.5px dashed rgba(93,155,232,0.4)', color: 'var(--color-blue)' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
                    <polyline points="16 6 12 2 8 6" />
                    <line x1="12" y1="2" x2="12" y2="15" />
                  </svg>
                  Share Video to X
                </button>
              ) : (
                <div className="space-y-2">
                  <button
                    onClick={handleDownload}
                    className="w-full py-3 rounded-[4px] text-sm chalk-header tracking-wide cursor-pointer transition-all flex items-center justify-center gap-2"
                    style={{ background: 'rgba(93,155,232,0.15)', border: '1.5px dashed rgba(93,155,232,0.4)', color: 'var(--color-blue)' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Download Video
                  </button>
                  <p className="text-[10px] text-center" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
                    Download then upload directly to X for native video embedding
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleCopyLink}
                  className="flex-1 py-2.5 rounded-[4px] text-xs chalk-header cursor-pointer transition-all"
                  style={{
                    background: copied ? 'rgba(93,232,138,0.12)' : 'rgba(245,217,96,0.12)',
                    border: `1.5px dashed ${copied ? 'rgba(93,232,138,0.3)' : 'rgba(245,217,96,0.3)'}`,
                    color: copied ? 'var(--color-green)' : 'var(--color-yellow)',
                  }}
                >
                  {copied ? 'Copied!' : 'Copy Link'}
                </button>
                <button
                  onClick={handleDownload}
                  className="flex-1 py-2.5 rounded-[4px] text-xs chalk-header cursor-pointer transition-all"
                  style={{ background: 'rgba(232,228,217,0.06)', border: '1.5px dashed rgba(232,228,217,0.1)', color: 'var(--chalk-dim)' }}
                >
                  Download
                </button>
                <button
                  onClick={handleRedo}
                  className="py-2.5 px-3 rounded-[4px] text-xs chalk-header cursor-pointer transition-all"
                  style={{ background: 'rgba(232,93,93,0.08)', border: '1.5px dashed rgba(232,93,93,0.15)', color: 'var(--color-red)' }}
                >
                  Redo
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

async function reencodeWithTTS(videoBlobUrl: string, ttsAudioUrl: string): Promise<Blob> {
  const { FFmpeg } = await import('@ffmpeg/ffmpeg');

  const ffmpeg = new FFmpeg();
  await ffmpeg.load();

  // Fetch video and audio as array buffers
  const videoRes = await fetch(videoBlobUrl);
  const videoType = videoRes.headers.get('content-type') || '';
  const videoData = await videoRes.arrayBuffer();
  const audioData = await (await fetch(ttsAudioUrl)).arrayBuffer();

  // Detect input format — clips from browser MediaRecorder are WebM
  const isWebm = videoType.includes('webm') || !videoType.includes('mp4');
  const inputName = isWebm ? 'input.webm' : 'input.mp4';

  await ffmpeg.writeFile(inputName, new Uint8Array(videoData));
  await ffmpeg.writeFile('audio.mp3', new Uint8Array(audioData));

  // Re-encode to H.264 + AAC MP4 — Twitter/QuickTime compatible
  await ffmpeg.exec([
    '-i', inputName,
    '-i', 'audio.mp3',
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-map', '0:v:0',
    '-map', '1:a:0',
    '-shortest',
    '-movflags', '+faststart',
    'output.mp4',
  ]);

  const data = await ffmpeg.readFile('output.mp4') as Uint8Array;
  ffmpeg.terminate();

  return new Blob([new Uint8Array(data.buffer as ArrayBuffer)], { type: 'video/mp4' });
}
