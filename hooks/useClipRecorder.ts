'use client';

import { useRef, useState, useCallback, useEffect } from 'react';

interface UseClipRecorderReturn {
  startRecording: () => void;
  stopRecording: () => void;
  clip: () => Promise<Blob | null>;
  isRecording: boolean;
  isClipping: boolean;
  canClip: boolean;
  bufferSeconds: number;
}

const CHUNK_INTERVAL_MS = 500;
const MAX_BUFFER_SECS = 60;

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
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

export function useClipRecorder(videoRef: React.RefObject<HTMLVideoElement | null>): UseClipRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isClipping, setIsClipping] = useState(false);
  const [canClip, setCanClip] = useState(false);
  const [bufferSeconds, setBufferSeconds] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const mimeTypeRef = useRef<string>('');
  const bufferTimerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const cycleTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Audio capture removed — TTS narration is added during re-encode instead

  useEffect(() => {
    setCanClip(typeof MediaRecorder !== 'undefined' && getSupportedMimeType() !== '');
  }, []);

  const drawLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (video.videoWidth && video.videoHeight) {
      const w = Math.min(video.videoWidth, 1280);
      const h = Math.round(w * (video.videoHeight / video.videoWidth));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.drawImage(video, 0, 0, w, h);

      // Burn in "CHALK" text watermark
      ctx.save();
      ctx.font = 'bold 32px sans-serif';
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = '#f5d960';
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 6;
      ctx.fillText('CHALK', 16, 40);
      ctx.restore();
    }

    animFrameRef.current = requestAnimationFrame(drawLoop);
  }, [videoRef]);

  // Start a new MediaRecorder on the EXISTING stream (don't recreate stream)
  const startNewRecorder = useCallback(() => {
    const stream = streamRef.current;
    if (!stream || !mimeTypeRef.current) return;

    chunksRef.current = [];

    const recorder = new MediaRecorder(stream, {
      mimeType: mimeTypeRef.current,
      videoBitsPerSecond: 2_500_000,
    });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    recorder.start(CHUNK_INTERVAL_MS);
    recorderRef.current = recorder;
  }, []);

  // Cycle the recorder: stop current, start a new one on same stream
  const cycleRecorder = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;

    recorder.stop();

    // Start a fresh recorder on the same stream after a tiny delay
    setTimeout(() => {
      startNewRecorder();
    }, 50);
  }, [startNewRecorder]);

  const startRecording = useCallback(() => {
    const video = videoRef.current;
    if (!video || isRecording) return;

    const mimeType = getSupportedMimeType();
    if (!mimeType) return;
    mimeTypeRef.current = mimeType;

    // Create offscreen canvas
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    canvasRef.current = canvas;

    // Create the stream ONCE — reuse for all recorder cycles
    // No audio capture — TTS narration added during re-encode
    const canvasStream = canvas.captureStream(24);

    streamRef.current = canvasStream;

    drawLoop();
    startNewRecorder();
    setIsRecording(true);

    // Update buffer seconds display — cap at MAX_BUFFER_SECS and stop updating
    const recordingStart = Date.now();
    bufferTimerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - recordingStart) / 1000);
      if (elapsed >= MAX_BUFFER_SECS) {
        setBufferSeconds(MAX_BUFFER_SECS);
        clearInterval(bufferTimerRef.current);
      } else {
        setBufferSeconds(elapsed);
      }
    }, 1000);

    // Auto-cycle recorder at MAX_BUFFER_SECS to keep clips bounded
    cycleTimerRef.current = setTimeout(function autoCycle() {
      cycleRecorder();
      cycleTimerRef.current = setTimeout(autoCycle, MAX_BUFFER_SECS * 1000);
    }, MAX_BUFFER_SECS * 1000);
  }, [videoRef, isRecording, drawLoop, startNewRecorder, cycleRecorder]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
    }
    if (bufferTimerRef.current) clearInterval(bufferTimerRef.current);
    if (cycleTimerRef.current) clearTimeout(cycleTimerRef.current);

    recorderRef.current = null;
    canvasRef.current = null;
    streamRef.current = null;
    chunksRef.current = [];
    mimeTypeRef.current = '';
    setIsRecording(false);
    setBufferSeconds(0);
  }, []);

  // Clip: stop recorder, return all chunks as a valid WebM, restart recording
  const clip = useCallback(async (): Promise<Blob | null> => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') return null;

    setIsClipping(true);

    // Clear the auto-cycle timer (we're manually cycling now)
    if (cycleTimerRef.current) clearTimeout(cycleTimerRef.current);

    try {
      const blob = await new Promise<Blob | null>((resolve) => {
        recorder.onstop = () => {
          const allChunks = chunksRef.current;
          if (allChunks.length === 0) {
            resolve(null);
            return;
          }
          resolve(new Blob(allChunks, { type: recorder.mimeType }));
        };
        recorder.stop();
      });

      // Restart recording on the same stream
      startNewRecorder();

      // Restart auto-cycle
      cycleTimerRef.current = setTimeout(function autoCycle() {
        cycleRecorder();
        cycleTimerRef.current = setTimeout(autoCycle, MAX_BUFFER_SECS * 1000);
      }, MAX_BUFFER_SECS * 1000);

      return blob;
    } finally {
      setIsClipping(false);
    }
  }, [startNewRecorder, cycleRecorder]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) track.stop();
      }
      if (bufferTimerRef.current) clearInterval(bufferTimerRef.current);
      if (cycleTimerRef.current) clearTimeout(cycleTimerRef.current);
    };
  }, []);

  return { startRecording, stopRecording, clip, isRecording, isClipping, canClip, bufferSeconds };
}
