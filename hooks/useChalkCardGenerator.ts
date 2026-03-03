'use client';

import { useState, useCallback } from 'react';
import { Bet } from '@/components/betting/BetCard';
import { drawChalkCardStatic, ChalkCardFormat, FORMAT_SIZES, ChalkCardPerspective } from '@/lib/chalk-card-renderer';

interface UseChalkCardGeneratorReturn {
  generate: (bet: Bet, format: ChalkCardFormat, perspective?: ChalkCardPerspective) => Promise<Blob>;
  isGenerating: boolean;
}

export function useChalkCardGenerator(): UseChalkCardGeneratorReturn {
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(async (
    bet: Bet,
    format: ChalkCardFormat,
    perspective?: ChalkCardPerspective,
  ): Promise<Blob> => {
    setIsGenerating(true);

    try {
      await document.fonts.ready;

      const { w, h } = FORMAT_SIZES[format];
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;

      await drawChalkCardStatic(ctx, w, h, bet, perspective);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => b ? resolve(b) : reject(new Error('Failed to export image')),
          'image/png'
        );
      });

      return blob;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  return { generate, isGenerating };
}
