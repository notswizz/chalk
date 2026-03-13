'use client';

import { createPortal } from 'react-dom';

const SECTIONS = [
  {
    title: 'Watch',
    icon: 'M23 7l-7 5 7 5V7z M1 5h15v14H1z',
    color: 'var(--color-blue, #5db8e8)',
    desc: 'Stream live NBA, NCAA, NFL, MLB, NHL, and soccer with real-time scores',
  },
  {
    title: 'Bet',
    icon: 'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
    color: 'var(--color-yellow)',
    desc: 'Create peer-to-peer player props — set your own line and odds, someone takes the other side',
  },
  {
    title: 'Cash Out',
    icon: 'M9 14l6-6M4 2l16 16',
    color: 'var(--color-green)',
    desc: 'Propose to split the pot early — your opponent can accept, deny, or counter',
  },
  {
    title: 'Chat',
    icon: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z',
    color: 'var(--color-blue, #5db8e8)',
    desc: 'Game chat with all viewers, plus private trash talk between matched bettors',
  },
  {
    title: 'Clip',
    icon: 'M23 7l-7 5 7 5V7z',
    color: 'var(--color-red)',
    desc: 'Capture highlights from any stream, add AI voiceover, share to X',
  },
  {
    title: '$CHALK',
    icon: 'M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z',
    color: 'var(--color-yellow)',
    desc: 'Free tokens to start — win props to earn more, or buy $CHALK on Solana',
  },
  {
    title: 'Season 0',
    color: 'var(--color-green)',
    icon: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
    desc: 'Complete challenges, earn XP, climb the leaderboard for rewards',
  },
];

export function InfoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="chalk-card rounded-[6px] w-full max-w-md overflow-hidden fade-up flex flex-col"
        style={{ maxHeight: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px dashed var(--dust-light)' }}>
          <div>
            <span className="text-lg chalk-header" style={{ color: 'var(--color-yellow)' }}>CHALK</span>
            <span className="text-[9px] ml-2 uppercase tracking-widest" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>How it works</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-[4px] cursor-pointer" style={{ color: 'var(--chalk-ghost)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--dust-medium) transparent' }}>
          {/* Tagline */}
          <div className="text-center pb-2">
            <p className="text-sm" style={{ color: 'var(--chalk-white)', fontFamily: 'var(--font-chalk-body)' }}>
              Watch live sports, create player props, talk trash, and clip highlights — all in one place.
            </p>
          </div>

          {SECTIONS.map((section) => (
            <div key={section.title} className="flex items-start gap-3">
              <div className="flex-shrink-0 w-7 h-7 rounded-[4px] flex items-center justify-center mt-0.5" style={{ background: `${section.color}12` }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={section.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d={section.icon} />
                </svg>
              </div>
              <div>
                <div className="text-[11px] chalk-header tracking-wide" style={{ color: section.color }}>{section.title}</div>
                <div className="text-[11px] mt-0.5" style={{ color: 'var(--chalk-dim)', fontFamily: 'var(--font-chalk-body)', lineHeight: 1.5 }}>{section.desc}</div>
              </div>
            </div>
          ))}

          {/* Footer */}
          <div className="pt-3 text-center" style={{ borderTop: '1px dashed rgba(232,228,217,0.06)' }}>
            <p className="text-[10px]" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
              Built for degens by degens.
            </p>
            <div className="flex items-center justify-center gap-3 mt-2">
              <a href="https://x.com/chalk_streams" target="_blank" rel="noopener noreferrer" className="text-[10px] chalk-header" style={{ color: 'var(--color-yellow)' }}>@chalk_streams</a>
              <span style={{ color: 'var(--chalk-ghost)', opacity: 0.3 }}>|</span>
              <a href="https://discord.gg/VN2r3Gxg" target="_blank" rel="noopener noreferrer" className="text-[10px] chalk-header" style={{ color: 'var(--color-blue, #5db8e8)' }}>Discord</a>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
