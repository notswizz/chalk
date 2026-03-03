'use client';

import { useState } from 'react';

const MINT = '4khj2EMrS97s6LyWdSiga2yne74TfpbodFjd69mXpump';

const STEPS = [
  { num: '01', title: 'Buy CHALK', desc: 'Swap SOL for CHALK on pump.fun' },
  { num: '02', title: 'Connect Wallet', desc: 'Link your Solana wallet in-app' },
  { num: '03', title: 'Deposit', desc: 'Transfer CHALK into the app' },
  { num: '04', title: 'Draw it up', desc: 'Create props and bet on the board' },
];

export default function BuyPage() {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(MINT);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex flex-col px-4 pb-4" style={{ height: 'calc(100vh - 56px)' }}>
      {/* Chart — fills available space */}
      <div className="flex-1 min-h-0 rounded-[4px] overflow-hidden mt-3" style={{ border: '1.5px dashed rgba(232,228,217,0.1)' }}>
        <iframe
          src="https://dexscreener.com/solana/6gUYojSmZjwA9FKEtcK2UGWc1P7jRSEL6VtUDrYveYhL?embed=1&loadChartSettings=0&tabs=0&chartLeftToolbar=0&chartTheme=dark&theme=dark&chartStyle=0&chartType=usd&interval=15"
          style={{ width: '100%', height: '100%', border: 0 }}
        />
      </div>

      {/* Bottom bar */}
      <div className="flex items-center gap-3 mt-3">
        {/* Buy button */}
        <a
          href="https://pump.fun/coin/4khj2EMrS97s6LyWdSiga2yne74TfpbodFjd69mXpump"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-5 py-2.5 rounded-[4px] text-sm chalk-header tracking-wide transition-all hover:brightness-125 flex-shrink-0"
          style={{
            background: 'rgba(245,217,96,0.12)',
            border: '1.5px dashed rgba(245,217,96,0.35)',
            color: 'var(--color-yellow)',
          }}
        >
          Buy on pump.fun
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M7 17L17 7M17 7H7M17 7v10" />
          </svg>
        </a>

        {/* Contract address */}
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 px-3 py-2.5 rounded-[4px] cursor-pointer transition-all flex-shrink-0"
          style={{
            background: copied ? 'rgba(93,232,138,0.08)' : 'rgba(232,228,217,0.04)',
            border: `1px dashed ${copied ? 'rgba(93,232,138,0.3)' : 'rgba(232,228,217,0.1)'}`,
            color: copied ? 'var(--color-green)' : 'var(--chalk-ghost)',
          }}
        >
          {copied ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" /></svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
          )}
          <span className="text-[10px] tabular-nums" style={{ fontFamily: 'var(--font-chalk-mono)' }}>
            {copied ? 'Copied!' : `${MINT.slice(0, 6)}...${MINT.slice(-4)}`}
          </span>
        </button>

        {/* Steps — compact inline */}
        <div className="flex items-center gap-3 ml-auto">
          {STEPS.map((step) => (
            <div key={step.num} className="flex items-center gap-1.5">
              <span className="text-[9px] tabular-nums chalk-header" style={{ color: 'var(--chalk-ghost)' }}>{step.num}</span>
              <span className="text-[11px]" style={{ color: 'var(--chalk-dim)', fontFamily: 'var(--font-chalk-body)' }}>{step.title}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
