'use client';

import { useState, useRef, useEffect } from 'react';
import { useUser } from '@/hooks/useUser';
import { useConnectWallet } from '@privy-io/react-auth';
import { AddTokensModal } from './AddTokensModal';
import { WithdrawModal } from './WithdrawModal';
import { SetUsernameModal } from './SetUsernameModal';
import { useChalkPrice, formatUsd } from '@/hooks/useChalkPrice';

export function LoginButton() {
  const { login, logout, authenticated, ready, profile, loadingProfile, refreshProfile, needsUsername, setUsername, wallet, walletMismatch, savedWalletAddress, user } = useUser();
  const { connectWallet } = useConnectWallet();
  const { price } = useChalkPrice();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAddTokens, setShowAddTokens] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [mismatchToast, setMismatchToast] = useState(false);
  const [refCopied, setRefCopied] = useState(false);
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
      <>
        {/* Mobile: rainbow claim button */}
        <button
          onClick={login}
          className="md:hidden relative px-3 py-1.5 rounded-[4px] text-[11px] font-extrabold uppercase tracking-wider cursor-pointer transition-all duration-200 hover:scale-105 active:scale-95 overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #e85d5d, #f5d960, #5de88a, #5db8e8, #b05de8)',
            color: '#1a2a1a',
            fontFamily: 'var(--font-chalk-header)',
            textShadow: '0 1px 0 rgba(255,255,255,0.2)',
          }}
        >
          Claim 500 $CHALK
        </button>
        {/* Desktop: sign in button */}
        <button
          onClick={login}
          className="hidden md:flex items-center gap-2 px-4 py-2 rounded-[4px] text-sm font-semibold transition-all duration-200 hover:brightness-125 cursor-pointer"
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
      </>
    );
  }

  const name = profile?.displayName || 'User';
  const avatar = profile?.avatarUrl || '';

  return (
    <>
      <div className="flex items-center gap-3">
        {/* Chalk balance pill */}
        <div className="relative">
          <button
            onClick={() => {
              if (walletMismatch) { setMismatchToast(true); setTimeout(() => setMismatchToast(false), 3000); return; }
              wallet ? setShowAddTokens(true) : connectWallet();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] text-sm font-bold cursor-pointer transition-all duration-200 hover:brightness-125"
            style={{
              background: walletMismatch ? 'rgba(232,93,93,0.08)' : 'rgba(245,217,96,0.08)',
              border: `1px dashed ${walletMismatch ? 'rgba(232,93,93,0.25)' : 'rgba(245,217,96,0.15)'}`,
              color: walletMismatch ? 'var(--color-red)' : 'var(--color-yellow)',
            }}
            title={walletMismatch ? 'Wrong wallet connected' : 'Add Chalk'}
          >
            {walletMismatch ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <circle cx="12" cy="12" r="10" />
              </svg>
            )}
            {loadingProfile ? '--' : (profile?.coins ?? 0).toLocaleString()}
            {!loadingProfile && price !== null && (
              <span className="text-[10px] opacity-50 ml-0.5" style={{ color: 'var(--chalk-dim)' }}>
                {formatUsd(profile?.coins ?? 0, price)}
              </span>
            )}
            {!walletMismatch && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="ml-0.5 opacity-50">
                <path d="M12 5v14M5 12h14" />
              </svg>
            )}
          </button>
          {mismatchToast && savedWalletAddress && (
            <div
              className="absolute right-0 top-full mt-2 w-64 rounded-[4px] px-3 py-2.5 z-50 text-xs"
              style={{ background: 'var(--board-dark)', border: '1px dashed rgba(232,93,93,0.3)', color: 'var(--color-red)' }}
            >
              Wrong wallet. Switch to {savedWalletAddress.slice(0, 4)}...{savedWalletAddress.slice(-4)} in Phantom.
            </div>
          )}
        </div>

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

          {/* Dropdown */}
          {menuOpen && (
            <div
              className="absolute right-0 top-full mt-2 w-56 rounded-lg overflow-hidden shadow-2xl shadow-black/60 z-50"
              style={{
                background: 'rgba(22, 36, 22, 0.97)',
                border: '1px solid rgba(245,217,96,0.1)',
                backdropFilter: 'blur(16px)',
              }}
            >
              {/* User info header */}
              <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: '1px dashed rgba(232,228,217,0.06)' }}>
                {avatar ? (
                  <img src={avatar} alt={name} className="w-9 h-9 rounded-full object-cover ring-2 ring-yellow-500/20" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'var(--color-yellow)', color: 'var(--board-dark)' }}>
                    {name[0].toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate" style={{ color: 'var(--chalk-white)' }}>{name}</div>
                  <div className="text-[11px] truncate" style={{ color: 'var(--chalk-ghost)' }}>
                    {user?.email?.address || user?.google?.email || ''}
                  </div>
                </div>
              </div>

              <div className="py-1.5">
                {!wallet ? (
                  <button
                    onClick={() => { setMenuOpen(false); connectWallet(); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-all duration-150 cursor-pointer hover:bg-[rgba(245,217,96,0.06)]"
                    style={{ color: 'var(--color-yellow)' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                      <rect x="2" y="6" width="20" height="12" rx="2" />
                      <path d="M16 12h.01" />
                    </svg>
                    Connect Wallet
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        if (walletMismatch) { setMenuOpen(false); setMismatchToast(true); setTimeout(() => setMismatchToast(false), 3000); return; }
                        setMenuOpen(false); setShowAddTokens(true);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-all duration-150 cursor-pointer hover:bg-[rgba(245,217,96,0.06)]"
                      style={{ color: walletMismatch ? 'var(--chalk-ghost)' : 'var(--chalk-dim)' }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-yellow)" strokeWidth="2" className="shrink-0">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 8v8M8 12h8" />
                      </svg>
                      Deposit
                      {walletMismatch && <span className="text-[10px] ml-auto px-1.5 py-0.5 rounded" style={{ background: 'rgba(232,93,93,0.15)', color: 'var(--color-red)' }}>wrong wallet</span>}
                    </button>
                    <button
                      onClick={() => {
                        if (walletMismatch) { setMenuOpen(false); setMismatchToast(true); setTimeout(() => setMismatchToast(false), 3000); return; }
                        setMenuOpen(false); setShowWithdraw(true);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-all duration-150 cursor-pointer hover:bg-[rgba(245,217,96,0.06)]"
                      style={{ color: walletMismatch ? 'var(--chalk-ghost)' : 'var(--chalk-dim)' }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-yellow)" strokeWidth="2" className="shrink-0">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M8 12h8M12 8l4 4-4 4" />
                      </svg>
                      Withdraw
                      {walletMismatch && <span className="text-[10px] ml-auto px-1.5 py-0.5 rounded" style={{ background: 'rgba(232,93,93,0.15)', color: 'var(--color-red)' }}>wrong wallet</span>}
                    </button>
                  </>
                )}
                {needsUsername && (
                  <button
                    onClick={() => { setMenuOpen(false); setShowEditProfile(true); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-all duration-150 cursor-pointer hover:bg-[rgba(245,217,96,0.06)]"
                    style={{ color: 'var(--chalk-dim)' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    Set Username
                  </button>
                )}
                {profile?.displayName && profile.displayName !== 'User' && (
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}/ref/${encodeURIComponent(profile.displayName)}`;
                      navigator.clipboard.writeText(url);
                      setRefCopied(true);
                      setTimeout(() => setRefCopied(false), 2000);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-all duration-150 cursor-pointer hover:bg-[rgba(245,217,96,0.06)]"
                    style={{ color: 'var(--color-yellow)' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    {refCopied ? 'Copied!' : 'Invite Friend (+500)'}
                  </button>
                )}
              </div>

              <div className="mx-3" style={{ borderTop: '1px dashed rgba(232,228,217,0.06)' }} />

              <div className="py-1.5">
                <button
                  onClick={() => { setMenuOpen(false); logout(); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-all duration-150 cursor-pointer hover:bg-[rgba(232,93,93,0.06)]"
                  style={{ color: 'var(--chalk-ghost)' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                  </svg>
                  Sign out
                </button>
              </div>
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
