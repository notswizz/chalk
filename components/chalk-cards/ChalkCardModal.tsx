'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Bet } from '@/components/betting/BetCard';
import { useChalkCardGenerator } from '@/hooks/useChalkCardGenerator';
import { FORMAT_SIZES, ChalkCardPerspective, drawChalkCardStatic } from '@/lib/chalk-card-renderer';
import { uploadChalkCard } from '@/lib/chalk-cards';
import { useUser } from '@/hooks/useUser';
import { toAmericanOdds } from '@/components/betting/BetCard';

const STAT_LABELS: Record<string, string> = { points: 'PTS', rebounds: 'REB', assists: 'AST', threes: '3PM' };

export function ChalkCardModal({ bet, onClose }: { bet: Bet; onClose: () => void }) {
  const { profile, userId, getAccessToken } = useUser();
  const { generate, isGenerating } = useChalkCardGenerator();

  const isCreator = userId === bet.creatorId;
  const counterDir = bet.direction === 'over' ? 'under' : 'over';
  const userDir = isCreator ? bet.direction : counterDir;
  const userStake = isCreator ? bet.creatorStake : bet.takerStake;
  const userDecimal = isCreator ? (bet.takerStake / bet.creatorStake) : (bet.creatorStake / bet.takerStake);
  const userOdds = toAmericanOdds(userDecimal);
  const userName = isCreator ? (bet.creatorName || 'Anonymous') : (bet.takerName || 'Anonymous');
  const userWon = bet.result === 'push' ? null : bet.result === 'creator_wins' ? isCreator : !isCreator;

  const perspective: ChalkCardPerspective = {
    direction: userDir,
    stake: userStake,
    odds: userOdds,
    name: userName,
    isWinner: userWon,
  };

  const format = 'square' as const;
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [cardUrl, setCardUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const previewRef = useRef<HTMLCanvasElement>(null);

  // Draw live preview whenever format changes
  const drawPreview = useCallback(async () => {
    const canvas = previewRef.current;
    if (!canvas) return;
    await document.fonts.ready;
    const { w, h } = FORMAT_SIZES[format];
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    await drawChalkCardStatic(ctx, w, h, bet, perspective);
  }, [bet, perspective]);

  useEffect(() => {
    drawPreview();
  }, [drawPreview]);

  // Cleanup image URL on unmount
  useEffect(() => {
    return () => { if (imageUrl) URL.revokeObjectURL(imageUrl); };
  }, [imageUrl]);

  async function handleGenerate() {
    setError(null);
    try {
      const blob = await generate(bet, format, perspective);
      const url = URL.createObjectURL(blob);
      setImageBlob(blob);
      setImageUrl(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    }
  }

  async function handleSave() {
    if (!imageBlob) return;
    setSaving(true);
    try {
      const cardId = `card_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const url = await uploadChalkCard(imageBlob, cardId);

      const token = await getAccessToken();
      await fetch('/api/chalk-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          id: cardId,
          userName: profile?.displayName || 'User',
          betId: bet.id,
          player: bet.player,
          stat: bet.stat,
          target: bet.target,
          direction: userDir,
          result: bet.result || null,
          gameTitle: bet.gameTitle || '',
          format,
          duration: 0,
          url,
        }),
      });

      setCardUrl(`${window.location.origin}/card/${cardId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function handleDownload() {
    if (!imageBlob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(imageBlob);
    a.download = `chalk-${bet.player.replace(/\s+/g, '-').toLowerCase()}.png`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function handleCopyLink() {
    if (!cardUrl) return;
    navigator.clipboard.writeText(cardUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function handleTwitterShare() {
    if (!cardUrl) return;
    const statLabel = STAT_LABELS[bet.stat] || bet.stat;
    const text = encodeURIComponent(`${bet.player} ${userDir.toUpperCase()} ${bet.target} ${statLabel}\n\n${cardUrl}`);
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
  }

  function handleWebShare() {
    if (!cardUrl || !navigator.share) return;
    const statLabel = STAT_LABELS[bet.stat] || bet.stat;
    navigator.share({
      title: 'Chalk Card',
      text: `${bet.player} ${userDir.toUpperCase()} ${bet.target} ${statLabel}`,
      url: cardUrl,
    }).catch(() => {});
  }

  const hasImage = !!imageUrl;
  const hasSaved = !!cardUrl;

  const aspectClass = 'aspect-square';

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
          <span className="chalk-header text-base" style={{ color: 'var(--chalk-white)' }}>Share Card</span>
          <button onClick={onClose} className="p-1 rounded-[4px] cursor-pointer" style={{ color: 'var(--chalk-ghost)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Preview */}
          <div className={`${aspectClass} max-h-[50vh] mx-auto rounded-[4px] overflow-hidden bg-black`}>
            {hasImage ? (
              <img src={imageUrl} alt="Chalk card" className="w-full h-full object-contain" />
            ) : (
              <canvas ref={previewRef} className="w-full h-full object-contain" />
            )}
          </div>


          {/* Error */}
          {error && (
            <p className="text-xs" style={{ color: 'var(--color-red)', fontFamily: 'var(--font-chalk-body)' }}>{error}</p>
          )}

          {/* Generate button */}
          {!hasImage && (
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full py-3 rounded-[4px] text-sm chalk-header tracking-wide cursor-pointer transition-all disabled:opacity-60"
              style={{
                background: isGenerating ? 'rgba(245,217,96,0.08)' : 'rgba(245,217,96,0.12)',
                border: '1.5px dashed rgba(245,217,96,0.3)',
                color: 'var(--color-yellow)',
              }}
            >
              {isGenerating ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  Creating...
                </span>
              ) : (
                'Create Card'
              )}
            </button>
          )}

          {/* Post-generate: save & share */}
          {hasImage && !hasSaved && (
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 rounded-[4px] text-xs chalk-header cursor-pointer transition-all disabled:opacity-50"
                style={{ background: 'rgba(93,232,138,0.12)', border: '1.5px dashed rgba(93,232,138,0.3)', color: 'var(--color-green)' }}
              >
                {saving ? 'Saving...' : 'Save & Share'}
              </button>
              <button
                onClick={handleDownload}
                className="py-2.5 px-4 rounded-[4px] text-xs chalk-header cursor-pointer transition-all"
                style={{ background: 'rgba(232,228,217,0.06)', border: '1.5px dashed rgba(232,228,217,0.1)', color: 'var(--chalk-dim)' }}
              >
                Download
              </button>
              <button
                onClick={() => { if (imageUrl) URL.revokeObjectURL(imageUrl); setImageUrl(null); setImageBlob(null); }}
                className="py-2.5 px-3 rounded-[4px] text-xs chalk-header cursor-pointer transition-all"
                style={{ background: 'rgba(232,93,93,0.08)', border: '1.5px dashed rgba(232,93,93,0.15)', color: 'var(--color-red)' }}
              >
                Redo
              </button>
            </div>
          )}

          {/* Share actions */}
          {hasSaved && (
            <div className="space-y-3">
              <div className="text-center">
                <span className="text-xs chalk-header" style={{ color: 'var(--color-green)' }}>Card saved!</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleDownload}
                  className="flex-1 py-2.5 rounded-[4px] text-xs chalk-header cursor-pointer transition-all"
                  style={{ background: 'rgba(232,228,217,0.06)', border: '1.5px dashed rgba(232,228,217,0.1)', color: 'var(--chalk-dim)' }}
                >
                  Download
                </button>
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
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleTwitterShare}
                  className="flex-1 py-2.5 rounded-[4px] text-xs chalk-header cursor-pointer transition-all"
                  style={{ background: 'rgba(93,155,232,0.12)', border: '1.5px dashed rgba(93,155,232,0.3)', color: 'var(--color-blue)' }}
                >
                  Share on X
                </button>
                {typeof navigator !== 'undefined' && 'share' in navigator && (
                  <button
                    onClick={handleWebShare}
                    className="flex-1 py-2.5 rounded-[4px] text-xs chalk-header cursor-pointer transition-all"
                    style={{ background: 'rgba(232,168,93,0.12)', border: '1.5px dashed rgba(232,168,93,0.3)', color: 'var(--color-orange)' }}
                  >
                    Share
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
