'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useUser } from '@/hooks/useUser';

const TOKEN_OPTIONS = [
  { amount: 100, label: '100' },
  { amount: 250, label: '250' },
  { amount: 500, label: '500' },
  { amount: 1000, label: '1,000' },
];

export function AddTokensModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const { getAccessToken } = useUser();
  const [selected, setSelected] = useState(500);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleAdd() {
    setLoading(true);
    setError('');
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/users/add-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: selected }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to add chalk');
        return;
      }
      onAdded();
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
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
          <h2 className="text-base font-bold" style={{ color: 'var(--chalk-white)', fontFamily: 'var(--font-chalk-header)' }}>Add Chalk</h2>
          <button onClick={onClose} className="transition-colors cursor-pointer" style={{ color: 'var(--chalk-ghost)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="text-xs mb-4" style={{ color: 'var(--chalk-ghost)' }}>
          Free chalk for testing. In the future this will be linked to SOL deposits.
        </p>

        <div className="grid grid-cols-2 gap-2.5 mb-5">
          {TOKEN_OPTIONS.map((opt) => (
            <button
              key={opt.amount}
              onClick={() => setSelected(opt.amount)}
              className="flex items-center justify-center gap-2 py-3 rounded-[4px] text-sm font-bold transition-all duration-200 cursor-pointer"
              style={{
                background: selected === opt.amount
                  ? 'rgba(245,217,96,0.12)'
                  : 'var(--dust-light)',
                border: `1px dashed ${selected === opt.amount ? 'rgba(245,217,96,0.3)' : 'var(--dust-medium)'}`,
                color: selected === opt.amount ? 'var(--color-yellow)' : 'var(--chalk-ghost)',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill={selected === opt.amount ? 'var(--color-yellow)' : 'var(--chalk-ghost)'} stroke="none">
                <circle cx="12" cy="12" r="10" />
              </svg>
              {opt.label}
            </button>
          ))}
        </div>

        {error && <p className="text-xs mb-3" style={{ color: 'var(--color-red)' }}>{error}</p>}

        <button
          onClick={handleAdd}
          disabled={loading}
          className="w-full py-3 rounded-[4px] text-sm font-bold transition-all duration-200 disabled:opacity-50 cursor-pointer"
          style={{
            background: 'rgba(245,217,96,0.15)',
            border: '1px dashed rgba(245,217,96,0.3)',
            color: 'var(--color-yellow)',
          }}
        >
          {loading ? 'Adding...' : `Add ${selected.toLocaleString()} Chalk`}
        </button>
      </div>
    </div>,
    document.body
  );
}
