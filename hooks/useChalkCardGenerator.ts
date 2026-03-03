'use client';

import { useState, useCallback } from 'react';
import { Bet } from '@/components/betting/BetCard';
import { drawChalkCardFrame, ChalkCardFormat, FORMAT_SIZES } from '@/lib/chalk-card-renderer';

interface UseChalkCardGeneratorReturn {
  generate: (bet: Bet, format: ChalkCardFormat, text: string, voice?: string, token?: string) => Promise<Blob>;
  isGenerating: boolean;
  progress: number;
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

export function useChalkCardGenerator(): UseChalkCardGeneratorReturn {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  const generate = useCallback(async (
    bet: Bet,
    format: ChalkCardFormat,
    text: string,
    voice?: string,
    token?: string,
  ): Promise<Blob> => {
    setIsGenerating(true);
    setProgress(0);

    try {
      // 1. Generate TTS audio
      setProgress(0.05);
      const ttsRes = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ text, voice }),
      });

      if (!ttsRes.ok) {
        let errMsg = 'TTS failed';
        try { const err = await ttsRes.json(); errMsg = err.error || errMsg; } catch { /* */ }
        throw new Error(errMsg);
      }

      setProgress(0.15);

      // 2. Decode audio — TTS API returns raw MP3 binary
      const audioCtx = new AudioContext();
      const audioArrayBuffer = await ttsRes.arrayBuffer();
      const audioBuffer = await audioCtx.decodeAudioData(audioArrayBuffer);
      setProgress(0.25);

      // Wait for fonts
      await document.fonts.ready;

      // 3. Setup canvas
      const { w, h } = FORMAT_SIZES[format];
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;

      // 4. Duration = TTS audio length + 0.5s padding (min 3s, no cap — video matches voice)
      const audioDur = audioBuffer.duration;
      const totalDuration = Math.max(audioDur + 0.5, 3);

      // 5. Setup recording
      const mimeType = getSupportedMimeType();
      const canvasStream = canvas.captureStream(30);

      // Audio: play TTS through AudioContext → MediaStreamDestination
      const dest = audioCtx.createMediaStreamDestination();
      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(dest);

      // Add audio track to canvas stream
      for (const track of dest.stream.getAudioTracks()) {
        canvasStream.addTrack(track);
      }

      const chunks: Blob[] = [];
      const recorder = new MediaRecorder(canvasStream, {
        mimeType,
        videoBitsPerSecond: 3_000_000,
      });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      // 6. Run animation
      recorder.start(100);
      source.start(0);

      const startTime = performance.now();

      await new Promise<void>((resolve) => {
        function frame() {
          const elapsed = (performance.now() - startTime) / 1000;
          const p = Math.min(1, elapsed / totalDuration);
          setProgress(0.25 + p * 0.7);

          drawChalkCardFrame(ctx, w, h, bet, p);

          if (p < 1) {
            requestAnimationFrame(frame);
          } else {
            resolve();
          }
        }
        requestAnimationFrame(frame);
      });

      // 7. Stop and collect
      source.stop();

      const blob = await new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          resolve(new Blob(chunks, { type: mimeType }));
        };
        recorder.stop();
      });

      // Cleanup
      for (const track of canvasStream.getTracks()) track.stop();
      audioCtx.close();

      setProgress(1);
      return blob;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  return { generate, isGenerating, progress };
}
