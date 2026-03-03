'use client';

import { useState, useRef, useEffect } from 'react';
import { useUser } from '@/hooks/useUser';
import { useConnectWallet } from '@privy-io/react-auth';
import { AddTokensModal } from './AddTokensModal';
import { WithdrawModal } from './WithdrawModal';
import { SetUsernameModal } from './SetUsernameModal';
import { useChalkPrice, formatUsd } from '@/hooks/useChalkPrice';

export function LoginButton() {
  const { login, logout, authenticated, ready, profile, loadingProfile, refreshProfile, needsUsername, setUsername, wallet } = useUser();
  const { connectWallet } = useConnectWallet();
  const { price } = useChalkPrice();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAddTokens, setShowAddTokens] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  if (!ready) return null;

  if (!authenticated) {
    return (
      <button
        onClick={login}
        className="flex items-center gap-2 px-4 py-2 rounded-[4px] text-sm font-semibold transition-all duration-200 hover:brightness-125 cursor-pointer"
        style={{
          background: 'rgba(245,217,96,0.12)',
          border: '1px dashed rgba(245,217,96,0.25)',
          color: 'var(--color-yellow)',
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />
        </svg>
        Sign in
      </button>
    );
  }

  const name = profile?.displayName || 'User';
  const avatar = profile?.avatarUrl || '';

  return (
    <>
      <div className="flex items-center gap-3">
        {/* Chalk balance pill */}
        <button
          onClick={() => wallet ? setShowAddTokens(true) : connectWallet()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] text-sm font-bold cursor-pointer transition-all duration-200 hover:brightness-125"
          style={{
            background: 'rgba(245,217,96,0.08)',
            border: '1px dashed rgba(245,217,96,0.15)',
            color: 'var(--color-yellow)',
          }}
          title="Add Chalk"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
            <circle cx="12" cy="12" r="10" />
          </svg>
          {loadingProfile ? '--' : (profile?.coins ?? 0).toLocaleString()}
          {!loadingProfile && price !== null && (
            <span className="text-[10px] opacity-50 ml-0.5" style={{ color: 'var(--chalk-dim)' }}>
              {formatUsd(profile?.coins ?? 0, price)}
            </span>
          )}
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="ml-0.5 opacity-50">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>

        {/* Profile badge with dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-[4px] text-sm font-medium transition-all duration-200 cursor-pointer"
            style={{
              background: 'var(--dust-light)',
              border: '1px dashed var(--dust-medium)',
            }}
          >
            {avatar ? (
              <img
                src={avatar}
                alt={name}
                className="w-7 h-7 rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold"
                style={{ background: 'var(--color-yellow)', color: 'var(--board-dark)' }}
              >
                {name[0].toUpperCase()}
              </div>
            )}
            <span className="max-w-[140px] truncate font-semibold" style={{ color: 'var(--chalk-dim)' }}>
              {name}
            </span>
            <svg
              width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              className={`transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`}
              style={{ color: 'var(--chalk-ghost)' }}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {/* Dropdown — chalk-card style */}
          {menuOpen && (
            <div
              className="absolute right-0 top-full mt-2 w-48 rounded-[4px] py-1.5 shadow-2xl shadow-black/50 z-50 chalk-card"
            >
              {!wallet ? (
                <button
                  onClick={() => { setMenuOpen(false); connectWallet(); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition-colors cursor-pointer"
                  style={{ color: 'var(--color-yellow)' }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="6" width="20" height="12" rx="2" />
                    <path d="M16 12h.01" />
                  </svg>
                  Connect Wallet
                </button>
              ) : (
                <>
                  <button
                    onClick={() => { setMenuOpen(false); setShowAddTokens(true); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition-colors cursor-pointer"
                    style={{ color: 'var(--chalk-dim)' }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-yellow)" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 8v8M8 12h8" />
                    </svg>
                    Deposit
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); setShowWithdraw(true); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition-colors cursor-pointer"
                    style={{ color: 'var(--chalk-dim)' }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-yellow)" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M8 12h8M12 8l4 4-4 4" />
                    </svg>
                    Withdraw
                  </button>
                </>
              )}
              {needsUsername && (
                <button
                  onClick={() => { setMenuOpen(false); setShowEditProfile(true); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition-colors cursor-pointer"
                  style={{ color: 'var(--chalk-dim)' }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  Set Username
                </button>
              )}
              <div className="mx-3 my-1 chalk-divider" />
              <button
                onClick={() => { setMenuOpen(false); logout(); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition-colors cursor-pointer"
                style={{ color: 'var(--chalk-ghost)' }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                </svg>
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>

      {showAddTokens && (
        <AddTokensModal
          onClose={() => setShowAddTokens(false)}
          onAdded={() => { setShowAddTokens(false); refreshProfile(); }}
        />
      )}

      {showWithdraw && (
        <WithdrawModal
          onClose={() => setShowWithdraw(false)}
          onWithdrawn={() => { setShowWithdraw(false); refreshProfile(); }}
        />
      )}

      {showEditProfile && needsUsername && (
        <SetUsernameModal
          canClose
          onClose={() => setShowEditProfile(false)}
          onSubmit={async (name) => { await setUsername(name); setShowEditProfile(false); }}
        />
      )}

      {needsUsername && !loadingProfile && !showEditProfile && (
        <SetUsernameModal onSubmit={async (name) => { await setUsername(name); }} />
      )}
    </>
  );
}
