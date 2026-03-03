'use client';

import { useState } from 'react';

const MINT = '4khj2EMrS97s6LyWdSiga2yne74TfpbodFjd69mXpump';

const STEPS = [
  {
    num: '01',
    title: 'Buy CHALK',
    desc: 'Swap SOL for CHALK on pump.fun',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v12M6 12h12" />
      </svg>
    ),
  },
  {
    num: '02',
    title: 'Connect Wallet',
    desc: 'Link your Solana wallet in-app',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <path d="M16 12h.01" />
      </svg>
    ),
  },
  {
    num: '03',
    title: 'Deposit',
    desc: 'Transfer CHALK into the app',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 3v12M5 10l7 7 7-7" />
        <path d="M5 21h14" />
      </svg>
    ),
  },
  {
    num: '04',
    title: 'Draw it up',
    desc: 'Create props and bet on the board',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
];

export default function BuyPage() {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(MINT);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="pinned-header-layout max-w-lg mx-auto px-4">
      {/* ─── Pinned Header ─── */}
      <div className="pinned-header pt-8 pb-2">
        <div className="text-center">
          {/* Chalk coin icon */}
          <div
            className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
            style={{
              background: 'rgba(245,217,96,0.1)',
              border: '2px dashed rgba(245,217,96,0.25)',
              boxShadow: '0 0 40px rgba(245,217,96,0.08)',
            }}
          >
            <span className="text-2xl chalk-score" style={{ color: 'var(--color-yellow)' }}>C</span>
          </div>
          <h1 className="text-2xl chalk-header mb-2" style={{ color: 'var(--chalk-white)' }}>
            Get Chalk
          </h1>
          <p className="text-sm" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
            Pick up CHALK tokens to start betting on the board
          </p>
        </div>
      </div>

      {/* ─── Scrollable Content ─── */}
      <div className="pinned-scroll scrollbar-hide">
        {/* Buy CTA */}
        <div className="mt-6 mb-8">
          <a
            href="https://pump.fun/coin/4khj2EMrS97s6LyWdSiga2yne74TfpbodFjd69mXpump"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center py-4 rounded-[4px] text-base chalk-header tracking-wide transition-all duration-200 hover:brightness-125"
            style={{
              background: 'rgba(245,217,96,0.12)',
              border: '1.5px dashed rgba(245,217,96,0.35)',
              color: 'var(--color-yellow)',
              boxShadow: '0 0 30px rgba(245,217,96,0.06)',
            }}
          >
            <span className="flex items-center justify-center gap-2.5">
              Buy on pump.fun
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M7 17L17 7M17 7H7M17 7v10" />
              </svg>
            </span>
          </a>
        </div>

        {/* Steps */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="section-label">How it works</span>
            <div className="flex-1 chalk-ruled-line" style={{ opacity: 0.3 }} />
          </div>

          <div className="space-y-3">
            {STEPS.map((step, i) => (
              <div
                key={step.num}
                className="chalk-card rounded-[4px] px-4 py-3.5 flex items-start gap-4 fade-up"
                style={{ animationDelay: `${i * 60}ms`, opacity: 0 }}
              >
                {/* Step icon */}
                <div
                  className="w-10 h-10 rounded-[4px] flex items-center justify-center flex-shrink-0"
                  style={{
                    background: 'rgba(245,217,96,0.06)',
                    border: '1px dashed rgba(245,217,96,0.12)',
                    color: 'var(--color-yellow)',
                  }}
                >
                  {step.icon}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[9px] tabular-nums chalk-header tracking-wider" style={{ color: 'var(--chalk-ghost)' }}>
                      {step.num}
                    </span>
                    <span className="text-sm chalk-header" style={{ color: 'var(--chalk-white)' }}>
                      {step.title}
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
                    {step.desc}
                  </p>
                </div>

                {/* Connecting line (except last) */}
                {i < STEPS.length - 1 && (
                  <div className="absolute" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Mint address */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="section-label">Contract</span>
            <div className="flex-1 chalk-ruled-line" style={{ opacity: 0.3 }} />
          </div>

          <button
            onClick={handleCopy}
            className="w-full chalk-card rounded-[4px] px-4 py-3 flex items-center gap-3 transition-all duration-200 cursor-pointer group"
            style={{
              border: copied
                ? '1.5px dashed rgba(93,232,138,0.3)'
                : '1.5px dashed rgba(232,228,217,0.18)',
            }}
          >
            <div
              className="w-8 h-8 rounded-[4px] flex items-center justify-center flex-shrink-0 transition-colors"
              style={{
                background: copied ? 'rgba(93,232,138,0.1)' : 'rgba(232,228,217,0.04)',
                color: copied ? 'var(--color-green)' : 'var(--chalk-ghost)',
              }}
            >
              {copied ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
              )}
            </div>
            <span
              className="text-[11px] truncate flex-1 text-left tabular-nums"
              style={{
                color: copied ? 'var(--color-green)' : 'var(--chalk-dim)',
                fontFamily: 'var(--font-chalk-mono)',
              }}
            >
              {copied ? 'Copied!' : MINT}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
