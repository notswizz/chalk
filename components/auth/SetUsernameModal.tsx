'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  currentName?: string;
  canClose?: boolean;
  onSubmit: (name: string) => Promise<void> | void;
  onClose?: () => void;
}

export function SetUsernameModal({ currentName = '', canClose = false, onSubmit, onClose }: Props) {
  const [value, setValue] = useState(currentName);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed.length < 2) { setError('At least 2 characters'); return; }
    if (trimmed.length > 20) { setError('20 characters max'); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) { setError('Letters, numbers, and underscores only'); return; }
    setSaving(true);
    try {
      await onSubmit(trimmed);
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={canClose ? onClose : undefined}
    >
      <div
        className="relative w-full max-w-sm rounded-[4px] p-6"
        style={{ background: 'var(--board-dark)', border: '1px dashed var(--dust-medium)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-bold" style={{ color: 'var(--chalk-white)', fontFamily: 'var(--font-chalk-header)' }}>
            {canClose ? 'Set Username' : 'Choose a username'}
          </h2>
          {canClose && onClose && (
            <button onClick={onClose} className="transition-colors cursor-pointer" style={{ color: 'var(--chalk-ghost)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <p className="text-xs mb-5" style={{ color: 'var(--chalk-ghost)' }}>This is how other players will see you.</p>

        <form onSubmit={handleSubmit}>
          <label className="text-[10px] font-bold uppercase tracking-wider mb-1 block" style={{ color: 'var(--chalk-ghost)' }}>Username</label>
          <input
            type="text"
            value={value}
            onChange={(e) => { setValue(e.target.value); setError(''); }}
            placeholder="username"
            autoFocus
            maxLength={20}
            className="input-field mb-2"
          />
          {error && <p className="text-xs mb-2" style={{ color: 'var(--color-red)' }}>{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 rounded-[4px] text-sm font-bold transition-all duration-200 cursor-pointer mt-2 disabled:opacity-50"
            style={{
              background: 'rgba(245,217,96,0.15)',
              border: '1px dashed rgba(245,217,96,0.3)',
              color: 'var(--color-yellow)',
            }}
          >
            {saving ? 'Saving...' : canClose ? 'Save' : 'Continue'}
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
}
