'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useUser } from '@/hooks/useUser';
import { useChalkPrice, formatUsd } from '@/hooks/useChalkPrice';

export function WithdrawModal({ onClose, onWithdrawn }: { onClose: () => void; onWithdrawn: () => void }) {
  const { getAccessToken, profile, wallet } = useUser();
  const { price } = useChalkPrice();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [txSignature, setTxSignature] = useState('');

  const walletAddress = wallet?.address || '';

  async function handleWithdraw() {
    const numAmount = parseInt(amount, 10);
    if (!numAmount || numAmount < 10) {
      setError('Minimum withdrawal is 10 CHALK');
      return;
    }
    if (numAmount > (profile?.coins ?? 0)) {
      setError('Insufficient balance');
      return;
    }
    if (!walletAddress) {
      setError('No wallet connected');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: numAmount, walletAddress }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Withdrawal failed');
        return;
      }
      setTxSignature(data.signature);
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  if (txSignature) {
    return createPortal(
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        onClick={() => { onWithdrawn(); }}
      >
        <div
          className="relative w-full max-w-sm rounded-[4px] p-6"
          style={{ background: 'var(--board-dark)', border: '1px dashed var(--dust-medium)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="text-base font-bold mb-4" style={{ color: 'var(--chalk-white)', fontFamily: 'var(--font-chalk-header)' }}>
            Withdrawal Sent
          </h2>
          <p className="text-xs mb-3" style={{ color: 'var(--chalk-ghost)' }}>
            {amount} CHALK{price !== null ? ` (~${formatUsd(parseInt(amount) || 0, price)})` : ''} sent to your wallet.
          </p>
          <a
            href={`https://solscan.io/tx/${txSignature}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs underline break-all"
            style={{ color: 'var(--color-yellow)' }}
          >
            View on Solscan
          </a>
          <button
            onClick={onWithdrawn}
            className="w-full mt-5 py-3 rounded-[4px] text-sm font-bold cursor-pointer"
            style={{
              background: 'rgba(245,217,96,0.15)',
              border: '1px dashed rgba(245,217,96,0.3)',
              color: 'var(--color-yellow)',
            }}
          >
            Done
          </button>
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-[4px] p-6"
        style={{ background: 'var(--board-dark)', border: '1px dashed var(--dust-medium)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold" style={{ color: 'var(--chalk-white)', fontFamily: 'var(--font-chalk-header)' }}>
            Withdraw CHALK
          </h2>
          <button onClick={onClose} className="transition-colors cursor-pointer" style={{ color: 'var(--chalk-ghost)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-4">
          <label className="text-xs mb-1 block" style={{ color: 'var(--chalk-ghost)' }}>
            Balance: {(profile?.coins ?? 0).toLocaleString()} CHALK{price !== null ? ` (~${formatUsd(profile?.coins ?? 0, price)})` : ''}
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount (min 10)"
            min={10}
            max={profile?.coins ?? 0}
            className="w-full px-3 py-2.5 rounded-[4px] text-sm outline-none"
            style={{
              background: 'var(--dust-light)',
              border: '1px dashed var(--dust-medium)',
              color: 'var(--chalk-white)',
            }}
          />
        </div>

        <div className="mb-5">
          <label className="text-xs mb-1 block" style={{ color: 'var(--chalk-ghost)' }}>
            Destination wallet
          </label>
          <input
            value={walletAddress}
            readOnly
            className="w-full px-3 py-2.5 rounded-[4px] text-xs outline-none truncate"
            style={{
              background: 'var(--dust-light)',
              border: '1px dashed var(--dust-medium)',
              color: 'var(--chalk-dim)',
            }}
          />
        </div>

        {error && <p className="text-xs mb-3" style={{ color: 'var(--color-red)' }}>{error}</p>}

        <button
          onClick={handleWithdraw}
          disabled={loading || !amount}
          className="w-full py-3 rounded-[4px] text-sm font-bold transition-all duration-200 disabled:opacity-50 cursor-pointer"
          style={{
            background: 'rgba(245,217,96,0.15)',
            border: '1px dashed rgba(245,217,96,0.3)',
            color: 'var(--color-yellow)',
          }}
        >
          {loading ? 'Sending...' : 'Withdraw'}
        </button>
      </div>
    </div>,
    document.body
  );
}
