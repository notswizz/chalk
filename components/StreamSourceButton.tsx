'use client';

import { StreamLink } from '@/lib/types';

interface StreamSourceButtonProps {
  stream: StreamLink;
  active: boolean;
  index: number;
  onClick: () => void;
  voteScore?: number;
  userVote?: 'up' | 'down' | null;
  onVote?: (vote: 'up' | 'down') => void;
}

export function StreamSourceButton({ stream, active, index, onClick, voteScore, userVote, onVote }: StreamSourceButtonProps) {
  const qualityColor =
    stream.quality === 'HD'
      ? 'var(--color-green)'
      : stream.quality === 'SD'
        ? 'var(--color-yellow)'
        : 'var(--chalk-ghost)';

  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col gap-1 px-4 py-2.5 rounded-[4px] text-sm font-semibold transition-all duration-200 ${
        active
          ? 'scale-[1.02]'
          : 'hover:scale-[1.01]'
      }`}
      style={{
        background: active
          ? 'rgba(245,217,96,0.12)'
          : 'var(--dust-light)',
        border: active
          ? '1px dashed rgba(245,217,96,0.4)'
          : '1px dashed var(--dust-medium)',
        color: active ? 'var(--chalk-white)' : 'var(--chalk-dim)',
        boxShadow: active
          ? '0 0 20px rgba(245, 217, 96, 0.1)'
          : 'none',
      }}
    >
      <div className="flex items-center gap-2.5">
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{
            backgroundColor: qualityColor,
            boxShadow: active ? `0 0 8px ${qualityColor}` : 'none',
          }}
        />
        <span>{stream.source || `Server ${index + 1}`}</span>
        <span className="text-[10px] font-bold uppercase tracking-wider opacity-50">
          {stream.quality}
        </span>
      </div>

      {/* Source name + voting row */}
      <div className="flex items-center gap-2 pl-[18px]">
        {stream.sourceName && (
          <span className="text-[10px] opacity-40">
            via {stream.sourceName}
          </span>
        )}
        {onVote && (
          <div className="flex items-center gap-1 ml-auto" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={(e) => { e.stopPropagation(); onVote('up'); }}
              className="p-0.5 transition-colors"
              style={{ color: userVote === 'up' ? 'var(--color-green)' : 'var(--chalk-ghost)' }}
              title="Upvote"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 10l5-5 5 5" /><path d="M12 5v14" />
              </svg>
            </button>
            <span
              className="text-[10px] font-bold tabular-nums min-w-[14px] text-center"
              style={{
                color: (voteScore ?? 0) > 0
                  ? 'var(--color-green)'
                  : (voteScore ?? 0) < 0
                    ? 'var(--color-red, #ef4444)'
                    : 'var(--chalk-ghost)',
              }}
            >
              {voteScore ?? 0}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); onVote('down'); }}
              className="p-0.5 transition-colors"
              style={{ color: userVote === 'down' ? 'var(--color-red, #ef4444)' : 'var(--chalk-ghost)' }}
              title="Downvote"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 14l5 5 5-5" /><path d="M12 19V5" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </button>
  );
}
