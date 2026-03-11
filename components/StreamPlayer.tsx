'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Hls from 'hls.js';
import { StreamLink } from '@/lib/types';
import { useClipRecorder } from '@/hooks/useClipRecorder';
import { useUser } from '@/hooks/useUser';
import { uploadClip } from '@/lib/clips';

interface StreamPlayerProps {
  stream: StreamLink;
  gameId?: string;
  gameTitle?: string;
}

export function StreamPlayer({ stream, gameId, gameTitle }: StreamPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const { authenticated, profile, getAccessToken } = useUser();
  const { startRecording, stopRecording, clip, isRecording, isClipping, canClip, bufferSeconds } = useClipRecorder(videoRef);

  // Reset clipper when stream source changes (not on initial mount)
  const prevStreamUrl = useRef(stream.url);
  useEffect(() => {
    if (prevStreamUrl.current !== stream.url) {
      prevStreamUrl.current = stream.url;
      stopRecording();
    }
  }, [stream.url, stopRecording]);

  const [clipStatus, setClipStatus] = useState<'idle' | 'clipping' | 'saving' | 'done' | 'error'>('idle');
  const [lastClipUrl, setLastClipUrl] = useState<string | null>(null);

  // Preview modal state
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (stream.type !== 'hls' || !videoRef.current) return;
    const video = videoRef.current;

    if (Hls.isSupported()) {
      const hls = new Hls({
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 6,
        liveDurationInfinity: true,
        enableWorker: true,
      });
      hls.loadSource(stream.url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });
      return () => hls.destroy();
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = stream.url;
      video.play().catch(() => {});
    }
  }, [stream]);

  // Auto-start recording when video plays
  useEffect(() => {
    if (stream.type !== 'hls' || isRecording || !isPlaying || !canClip) return;
    startRecording();
  }, [isPlaying, stream.type, isRecording, canClip, startRecording]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
    };
  }, []);

  const resetHideTimer = () => {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 3000);
  };

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen();
  };

  const goLive = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.buffered.length > 0) {
      video.currentTime = video.buffered.end(video.buffered.length - 1) - 0.5;
    }
    video.play().catch(() => {});
  };

  // Clip: grab everything in the buffer, show preview
  async function handleClip() {
    setClipStatus('clipping');

    try {
      const blob = await clip();
      if (!blob) {
        setClipStatus('error');
        setTimeout(() => setClipStatus('idle'), 2000);
        return;
      }

      const url = URL.createObjectURL(blob);
      setPreviewBlob(blob);
      setPreviewUrl(url);
      setClipStatus('idle');
    } catch (err) {
      console.error('Clip failed:', err);
      setClipStatus('error');
      setTimeout(() => setClipStatus('idle'), 3000);
    }
  }

  // User confirms save — receives trim params, close modal immediately, process in background
  function handleConfirmSave(blobUrl: string, trimStart: number, trimEnd: number, trimDuration: number, ttsAudioUrl?: string, clipTitle?: string) {
    closePreview();
    setClipStatus('saving');

    // Run trim + upload in background
    (async () => {
      try {
        // Re-encode trimmed portion in background using a hidden video
        const trimmedBlob = await reencodeClip(blobUrl, trimStart, trimEnd, ttsAudioUrl);

        const clipId = `clip_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const url = await uploadClip(trimmedBlob, clipId);

        const token = await getAccessToken();
        const res = await fetch('/api/clips', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            id: clipId,
            clipTitle: clipTitle || '',
            userName: profile?.displayName || 'User',
            gameId: gameId || '',
            gameTitle: gameTitle || '',
            sport: 'nba',
            duration: Math.round(trimDuration),
            url,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(`Clip metadata save failed: ${res.status} ${err.error || ''}`);
        }

        setLastClipUrl(`/clip/${clipId}`);
        setClipStatus('done');
        setTimeout(() => setClipStatus('idle'), 5000);
      } catch (err) {
        console.error('Clip save failed:', err);
        setClipStatus('error');
        setTimeout(() => setClipStatus('idle'), 4000);
      } finally {
        URL.revokeObjectURL(blobUrl);
      }
    })();
  }

  function closePreview() {
    setPreviewBlob(null);
    setPreviewUrl(null);
  }

  if (stream.type === 'iframe') {
    return (
      <div className="aspect-video w-full bg-black rounded-[4px] overflow-hidden">
        <iframe
          src={stream.url}
          className="w-full h-full border-0"
          allowFullScreen
          allow="autoplay; encrypted-media; picture-in-picture"
          sandbox="allow-scripts allow-same-origin allow-popups"
        />
      </div>
    );
  }

  const showClipBtn = authenticated && isRecording && stream.type === 'hls' && bufferSeconds >= 3;

  return (
    <>
      <div
        ref={containerRef}
        className="aspect-video w-full bg-black rounded-[4px] overflow-hidden relative select-none"
        onMouseMove={resetHideTimer}
        onTouchStart={resetHideTimer}
        onClick={togglePlay}
      >
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full"
        />

        {/* Big play button when paused */}
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{
                background: 'rgba(0,0,0,0.5)',
                backdropFilter: 'blur(8px)',
                border: '1px dashed var(--dust-medium)',
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="var(--chalk-white)" className="ml-1">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        )}

        {/* Clip status toast */}
        {clipStatus !== 'idle' && !previewBlob && (
          <div
            className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-[4px] text-sm chalk-header z-10 fade-up"
            style={{
              background: clipStatus === 'done' ? 'rgba(93,232,138,0.15)' : clipStatus === 'error' ? 'rgba(232,93,93,0.15)' : 'rgba(245,217,96,0.15)',
              border: `1px dashed ${clipStatus === 'done' ? 'rgba(93,232,138,0.3)' : clipStatus === 'error' ? 'rgba(232,93,93,0.3)' : 'rgba(245,217,96,0.3)'}`,
              color: clipStatus === 'done' ? 'var(--color-green)' : clipStatus === 'error' ? 'var(--color-red)' : 'var(--color-yellow)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {clipStatus === 'clipping' && 'Clipping...'}
            {clipStatus === 'saving' && 'Saving clip...'}
            {clipStatus === 'error' && 'Clip failed'}
            {clipStatus === 'done' && (
              <span className="flex items-center gap-2">
                Clip saved
                {lastClipUrl && (
                  <a href={lastClipUrl} className="underline" style={{ color: 'var(--color-yellow)' }} onClick={(e) => e.stopPropagation()}>
                    View
                  </a>
                )}
              </span>
            )}
          </div>
        )}

        {/* Controls overlay */}
        <div
          className={`absolute inset-0 flex flex-col justify-end transition-opacity duration-300 ${
            showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none" />

          <div className="relative flex items-center gap-2 px-4 py-3">
            <ControlButton onClick={togglePlay}>
              {isPlaying ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </ControlButton>

            <ControlButton onClick={toggleMute}>
              {isMuted ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 5L6 9H2v6h4l5 4V5z" />
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 5L6 9H2v6h4l5 4V5z" />
                  <path d="M15.54 8.46a5 5 0 010 7.07" />
                </svg>
              )}
            </ControlButton>

            <button
              onClick={goLive}
              className="ml-1 flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] text-[10px] font-bold uppercase tracking-wider transition-all hover:brightness-110"
              style={{
                background: 'var(--color-yellow)',
                color: 'var(--board-dark)',
                boxShadow: '0 2px 12px rgba(245, 217, 96, 0.3)',
                fontFamily: 'var(--font-chalk-header)',
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--board-dark)' }} />
              LIVE
            </button>

            <div className="flex-1" />

            {/* Clip button — single button, grabs last ~60s */}
            {showClipBtn && (
              <button
                onClick={handleClip}
                disabled={isClipping}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] text-[10px] font-bold uppercase tracking-wider transition-all hover:brightness-110 disabled:opacity-50 cursor-pointer"
                style={{
                  background: 'rgba(232,228,217,0.1)',
                  border: '1px dashed rgba(232,228,217,0.2)',
                  color: 'rgba(232,228,217,0.8)',
                  fontFamily: 'var(--font-chalk-header)',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="6" cy="6" r="3" />
                  <circle cx="6" cy="18" r="3" />
                  <line x1="20" y1="4" x2="8.12" y2="15.88" />
                  <line x1="14.47" y1="14.48" x2="20" y2="20" />
                  <line x1="8.12" y1="8.12" x2="12" y2="12" />
                </svg>
                Clip {Math.min(bufferSeconds, 60)}
              </button>
            )}

            <ControlButton
              onClick={() => {
                const video = videoRef.current;
                if (!video) return;
                if (document.pictureInPictureElement) document.exitPictureInPicture();
                else video.requestPictureInPicture().catch(() => {});
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <rect x="11" y="9" width="10" height="7" rx="1" fill="currentColor" />
              </svg>
            </ControlButton>

            <ControlButton onClick={toggleFullscreen}>
              {isFullscreen ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M8 3v3a2 2 0 01-2 2H3M21 8h-3a2 2 0 01-2-2V3M3 16h3a2 2 0 012 2v3M16 21v-3a2 2 0 012-2h3" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M8 3H5a2 2 0 00-2 2v3M21 8V5a2 2 0 00-2-2h-3M3 16v3a2 2 0 002 2h3M16 21h3a2 2 0 002-2v-3" />
                </svg>
              )}
            </ControlButton>
          </div>
        </div>
      </div>

      {/* Clip preview modal */}
      {previewBlob && previewUrl && createPortal(
        <ClipPreviewModal
          previewUrl={previewUrl}
          onConfirm={(blobUrl, trimStart, trimEnd, trimDuration, ttsAudioUrl, clipTitle) => handleConfirmSave(blobUrl, trimStart, trimEnd, trimDuration, ttsAudioUrl, clipTitle)}
          onDiscard={() => { if (previewUrl) URL.revokeObjectURL(previewUrl); closePreview(); }}
          getAccessToken={getAccessToken}
          gameTitle={gameTitle}
        />,
        document.body
      )}
    </>
  );
}

function getSupportedMimeType(): string {
  const types = [
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp8',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp9',
    'video/webm',
    'video/mp4',
  ];
  for (const type of types) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) return type;
  }
  return 'video/webm';
}

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

async function reencodeClip(blobUrl: string, trimStart: number, trimEnd: number, ttsAudioUrl?: string): Promise<Blob> {
  const mimeType = getSupportedMimeType();

  const video = document.createElement('video');
  video.src = blobUrl;
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';

  await new Promise<void>((resolve) => {
    video.onloadeddata = () => resolve();
    video.load();
  });

  const canvas = document.createElement('canvas');
  const w = video.videoWidth || 640;
  const h = video.videoHeight || 360;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const canvasStream = canvas.captureStream(24);

  // Audio: use TTS if provided, otherwise no audio (game audio removed per user request)
  let audioCtx: AudioContext | null = null;
  let ttsSource: AudioBufferSourceNode | null = null;

  if (ttsAudioUrl) {
    try {
      audioCtx = new AudioContext();
      const audioResponse = await fetch(ttsAudioUrl);
      const audioArrayBuffer = await audioResponse.arrayBuffer();
      const audioBuffer = await audioCtx.decodeAudioData(audioArrayBuffer);

      const dest = audioCtx.createMediaStreamDestination();
      ttsSource = audioCtx.createBufferSource();
      ttsSource.buffer = audioBuffer;
      ttsSource.connect(dest);

      for (const track of dest.stream.getAudioTracks()) {
        canvasStream.addTrack(track);
      }
    } catch {
      // TTS audio failed, continue without
    }
  }

  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(canvasStream, { mimeType, videoBitsPerSecond: 2_500_000 });
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  // Seek to trim start
  video.currentTime = trimStart;
  await new Promise<void>((resolve) => { video.onseeked = () => resolve(); });

  recorder.start(200);
  if (ttsSource) ttsSource.start(0);
  video.play().catch(() => {});

  let animFrame = 0;
  function draw() {
    ctx.drawImage(video, 0, 0, w, h);
    if (video.currentTime < trimEnd && !video.paused) {
      animFrame = requestAnimationFrame(draw);
    }
  }
  draw();

  await new Promise<void>((resolve) => {
    function check() {
      if (video.currentTime >= trimEnd || video.paused || video.ended) {
        resolve();
        return;
      }
      requestAnimationFrame(check);
    }
    check();
  });

  video.pause();
  cancelAnimationFrame(animFrame);
  if (ttsSource) try { ttsSource.stop(); } catch { /* already stopped */ }

  const blob = await new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    recorder.stop();
  });

  for (const track of canvasStream.getTracks()) track.stop();
  if (audioCtx) audioCtx.close().catch(() => {});

  return blob;
}

const TTS_VOICES = [
  { id: 'en-US-GuyNeural', label: 'Guy (US)' },
  { id: 'en-GB-RyanNeural', label: 'Ryan (UK)' },
  { id: 'en-US-AriaNeural', label: 'Aria (US)' },
  { id: 'en-AU-WilliamNeural', label: 'William (AU)' },
];

function ClipPreviewModal({
  previewUrl,
  onConfirm,
  onDiscard,
  getAccessToken,
  gameTitle,
}: {
  previewUrl: string;
  onConfirm: (blobUrl: string, trimStart: number, trimEnd: number, trimDuration: number, ttsAudioUrl?: string, clipTitle?: string) => void;
  onDiscard: () => void;
  getAccessToken: () => Promise<string | null>;
  gameTitle?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  // Title state
  const [clipTitle, setClipTitle] = useState('');

  // TTS state
  const [ttsText, setTtsText] = useState('');
  const [ttsVoice, setTtsVoice] = useState(TTS_VOICES[0].id);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [ttsError, setTtsError] = useState('');

  // Get video duration — WebM from MediaRecorder often reports Infinity
  // Fix: seek to a huge number, browser snaps to actual end, read currentTime
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let resolved = false;

    function trySetDuration(dur: number) {
      if (resolved || !dur || !isFinite(dur) || dur <= 0) return;
      resolved = true;
      setDuration(dur);
      setTrimEnd(dur);
      video!.currentTime = 0;
    }

    function onLoaded() {
      const dur = video!.duration;
      if (isFinite(dur) && dur > 0) {
        trySetDuration(dur);
      } else {
        // WebM Infinity duration hack: seek to huge value
        video!.currentTime = 1e10;
      }
    }

    function onSeeked() {
      if (!resolved && video!.currentTime > 0) {
        trySetDuration(video!.currentTime);
      }
    }

    function onDurationChange() {
      const dur = video!.duration;
      if (isFinite(dur) && dur > 0) {
        trySetDuration(dur);
      }
    }

    video.addEventListener('loadedmetadata', onLoaded);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('durationchange', onDurationChange);

    // If already loaded
    if (video.readyState >= 1) onLoaded();

    return () => {
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('durationchange', onDurationChange);
    };
  }, []);

  // Timeupdate handler — separate so trimStart/trimEnd deps don't re-run duration detection
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    function onTime() {
      setCurrentTime(video!.currentTime);
      if (trimEnd > 0 && video!.currentTime >= trimEnd) {
        video!.currentTime = trimStart;
      }
    }

    video.addEventListener('timeupdate', onTime);
    return () => video.removeEventListener('timeupdate', onTime);
  }, [trimStart, trimEnd]);

  // Seek video when trimStart changes
  useEffect(() => {
    const video = videoRef.current;
    if (video && duration > 0 && isFinite(trimStart)) {
      video.currentTime = trimStart;
    }
  }, [trimStart, duration]);

  const trimDuration = trimEnd - trimStart;

  // Handle drag on trim track
  function handleTrackInteraction(e: React.MouseEvent | React.TouchEvent, handle: 'start' | 'end') {
    e.preventDefault();
    e.stopPropagation();
    if (!trackRef.current || !duration) return;

    function getPos(clientX: number) {
      const rect = trackRef.current!.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return pct * duration;
    }

    function onMove(ev: MouseEvent | TouchEvent) {
      const clientX = 'touches' in ev ? ev.touches[0].clientX : ev.clientX;
      const time = getPos(clientX);
      if (handle === 'start') {
        setTrimStart(Math.min(time, trimEnd - 1));
      } else {
        setTrimEnd(Math.max(time, trimStart + 1));
      }
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove);
    document.addEventListener('touchend', onUp);
  }

  async function handleSave() {
    if (ttsText.trim()) {
      // Generate TTS first, then save with audio
      setTtsLoading(true);
      setTtsError('');
      try {
        const token = await getAccessToken();
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ text: ttsText, voice: ttsVoice }),
        });
        if (!res.ok) {
          let errMsg = 'TTS failed';
          try { const data = await res.json(); errMsg = data.error || errMsg; } catch { /* */ }
          setTtsError(errMsg);
          setTtsLoading(false);
          return;
        }
        // TTS returns raw MP3 binary — create a blob URL for reencodeClip
        const audioBlob = await res.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        setTtsLoading(false);
        onConfirm(previewUrl, trimStart, trimEnd, trimDuration, audioUrl, clipTitle || undefined);
      } catch {
        setTtsError('TTS generation failed');
        setTtsLoading(false);
      }
    } else {
      onConfirm(previewUrl, trimStart, trimEnd, trimDuration, undefined, clipTitle || undefined);
    }
  }
  const startPct = duration > 0 ? (trimStart / duration) * 100 : 0;
  const endPct = duration > 0 ? (trimEnd / duration) * 100 : 100;
  const playheadPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)' }}
      onClick={onDiscard}
    >
      <div
        className="w-full max-w-lg rounded-[4px] overflow-hidden fade-up"
        style={{ background: 'var(--board-dark)', border: '1px dashed var(--dust-medium)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px dashed var(--dust-light)' }}>
          <span className="chalk-header text-base" style={{ color: 'var(--chalk-white)' }}>Trim Clip</span>
          <button onClick={onDiscard} className="p-1 rounded-[4px] cursor-pointer" style={{ color: 'var(--chalk-ghost)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Video preview */}
        <div className="aspect-video bg-black">
          <video
            ref={videoRef}
            src={previewUrl}
            autoPlay
            playsInline
            className="w-full h-full object-contain"
          />
        </div>

        {/* Title + game tag */}
        <div className="px-4 pt-3">
          <input
            type="text"
            value={clipTitle}
            onChange={(e) => setClipTitle(e.target.value.slice(0, 80))}
            placeholder="Title your clip..."
            maxLength={80}
            className="w-full px-3 py-2 rounded-[4px] text-sm"
            style={{
              background: 'rgba(232,228,217,0.04)',
              border: '1px dashed rgba(232,228,217,0.1)',
              color: 'var(--chalk-white)',
              fontFamily: 'var(--font-chalk-body)',
              outline: 'none',
            }}
          />
          {gameTitle && (
            <div className="flex items-center gap-1.5 mt-2">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--color-yellow)" strokeWidth="2.5">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
                <line x1="7" y1="7" x2="7.01" y2="7" />
              </svg>
              <span className="text-[10px] chalk-header" style={{ color: 'var(--color-yellow)' }}>{gameTitle}</span>
            </div>
          )}
        </div>

        {/* Trim controls */}
        {duration > 0 && (
          <div className="px-4 pt-3">
            {/* Time labels */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] tabular-nums chalk-header" style={{ color: 'var(--color-yellow)' }}>
                {formatTime(trimStart)}
              </span>
              <span className="text-[10px] tabular-nums" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
                {formatTime(trimDuration)} selected
              </span>
              <span className="text-[10px] tabular-nums chalk-header" style={{ color: 'var(--color-yellow)' }}>
                {formatTime(trimEnd)}
              </span>
            </div>

            {/* Trim track */}
            <div
              ref={trackRef}
              className="relative h-8 rounded-[3px] cursor-pointer"
              style={{ background: 'rgba(232,228,217,0.06)' }}
            >
              {/* Selected range highlight */}
              <div
                className="absolute top-0 bottom-0 rounded-[2px]"
                style={{
                  left: `${startPct}%`,
                  width: `${endPct - startPct}%`,
                  background: 'rgba(245,217,96,0.12)',
                  borderTop: '2px solid rgba(245,217,96,0.4)',
                  borderBottom: '2px solid rgba(245,217,96,0.4)',
                }}
              />

              {/* Playhead */}
              <div
                className="absolute top-0 bottom-0 w-[2px]"
                style={{
                  left: `${playheadPct}%`,
                  background: 'var(--chalk-white)',
                  opacity: 0.6,
                }}
              />

              {/* Start handle */}
              <div
                className="absolute top-0 bottom-0 w-3 cursor-ew-resize z-10 flex items-center justify-center"
                style={{ left: `calc(${startPct}% - 6px)` }}
                onMouseDown={(e) => handleTrackInteraction(e, 'start')}
                onTouchStart={(e) => handleTrackInteraction(e, 'start')}
              >
                <div
                  className="w-1 h-5 rounded-full"
                  style={{ background: 'var(--color-yellow)', boxShadow: '0 0 6px rgba(245,217,96,0.4)' }}
                />
              </div>

              {/* End handle */}
              <div
                className="absolute top-0 bottom-0 w-3 cursor-ew-resize z-10 flex items-center justify-center"
                style={{ left: `calc(${endPct}% - 6px)` }}
                onMouseDown={(e) => handleTrackInteraction(e, 'end')}
                onTouchStart={(e) => handleTrackInteraction(e, 'end')}
              >
                <div
                  className="w-1 h-5 rounded-full"
                  style={{ background: 'var(--color-yellow)', boxShadow: '0 0 6px rgba(245,217,96,0.4)' }}
                />
              </div>
            </div>
          </div>
        )}

        {/* TTS Narration */}
        <div className="px-4 pt-3">
          <label className="block text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
            Add narration ({ttsText.length}/280)
          </label>
          <textarea
            value={ttsText}
            onChange={(e) => setTtsText(e.target.value.slice(0, 280))}
            rows={2}
            placeholder="Optional: add your hot take..."
            className="w-full px-3 py-2 rounded-[4px] text-sm resize-none"
            style={{
              background: 'rgba(232,228,217,0.04)',
              border: '1px dashed rgba(232,228,217,0.1)',
              color: 'var(--chalk-white)',
              fontFamily: 'var(--font-chalk-body)',
              outline: 'none',
            }}
          />
          {ttsText.trim() && (
            <select
              value={ttsVoice}
              onChange={(e) => setTtsVoice(e.target.value)}
              className="w-full mt-2 px-3 py-1.5 rounded-[4px] text-xs cursor-pointer"
              style={{
                background: 'rgba(232,228,217,0.04)',
                border: '1px dashed rgba(232,228,217,0.1)',
                color: 'var(--chalk-dim)',
                fontFamily: 'var(--font-chalk-body)',
                outline: 'none',
              }}
            >
              {TTS_VOICES.map((v) => (
                <option key={v.id} value={v.id} style={{ background: 'var(--board-dark)' }}>{v.label}</option>
              ))}
            </select>
          )}
          {ttsError && <p className="text-[10px] mt-1" style={{ color: 'var(--color-red)', fontFamily: 'var(--font-chalk-body)' }}>{ttsError}</p>}
        </div>

        {/* Actions */}
        <div className="p-4 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={ttsLoading}
            className="flex-1 py-3 rounded-[4px] text-sm chalk-header tracking-wide cursor-pointer transition-all disabled:opacity-50"
            style={{
              background: 'rgba(93,232,138,0.12)',
              border: '1.5px dashed rgba(93,232,138,0.3)',
              color: 'var(--color-green)',
            }}
          >
            {ttsLoading ? 'Generating voice...' : `Save ${formatTime(trimDuration)} Clip`}
          </button>

          <button
            onClick={onDiscard}
            className="py-3 px-5 rounded-[4px] text-sm chalk-header cursor-pointer transition-all"
            style={{
              background: 'rgba(232,93,93,0.08)',
              border: '1.5px dashed rgba(232,93,93,0.2)',
              color: 'var(--color-red)',
            }}
          >
            Discard
          </button>
        </div>
      </div>
    </div>
  );
}

function ControlButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="w-8 h-8 rounded-[4px] flex items-center justify-center transition-all"
      style={{ color: 'rgba(232,228,217,0.8)' }}
    >
      {children}
    </button>
  );
}
