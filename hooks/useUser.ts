'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets } from '@privy-io/react-auth/solana';
import React from 'react';

interface UserProfile {
  coins: number;
  displayName: string;
  avatarUrl: string;
}

interface UserContextValue {
  user: ReturnType<typeof usePrivy>['user'];
  wallet: ReturnType<typeof useWallets>['wallets'][0] | null;
  login: ReturnType<typeof usePrivy>['login'];
  logout: ReturnType<typeof usePrivy>['logout'];
  authenticated: boolean;
  ready: boolean;
  userId: string | null;
  profile: UserProfile | null;
  loadingProfile: boolean;
  needsUsername: boolean;
  setUsername: (name: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  getAccessToken: ReturnType<typeof usePrivy>['getAccessToken'];
  savedWalletAddress: string | null;
  walletMismatch: boolean;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const { user, login, logout, authenticated, ready, getAccessToken } = usePrivy();
  const { wallets } = useWallets();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [needsUsername, setNeedsUsername] = useState(false);
  const [savedWalletAddress, setSavedWalletAddress] = useState<string | null>(null);

  // Only use external wallets (Phantom, etc.) — ignore Privy embedded wallets
  // Privy embedded wallets may appear as "Privy" or "privy.io"
  const wallet = wallets.find((w) => {
    const name = w.standardWallet.name.toLowerCase();
    return !name.includes('privy');
  }) ?? null;

  const userId = user?.id ?? null;

  const privyAvatar = user?.twitter?.profilePictureUrl || '';

  const fetchProfile = useCallback(async () => {
    if (!authenticated) return;
    setLoadingProfile(true);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/users/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProfile({
          coins: data.coins,
          displayName: data.displayName || 'User',
          avatarUrl: data.avatarUrl || privyAvatar || '',
        });
        setNeedsUsername(data.usernameSet === false);
        setSavedWalletAddress(data.walletAddress || '');
      }
    } catch {
      // silent
    } finally {
      setLoadingProfile(false);
    }
  }, [authenticated, getAccessToken, privyAvatar]);

  useEffect(() => {
    if (authenticated) fetchProfile();
  }, [authenticated, fetchProfile]);

  // Sync wallet address to Firestore only when user has no saved wallet yet
  useEffect(() => {
    if (!authenticated || !wallet?.address || savedWalletAddress === null) return;
    // Only save if user has no wallet stored yet
    if (savedWalletAddress !== '') return;
    (async () => {
      try {
        const token = await getAccessToken();
        await fetch('/api/users/me', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ walletAddress: wallet.address }),
        });
        setSavedWalletAddress(wallet.address);
      } catch { /* silent */ }
    })();
  }, [authenticated, wallet?.address, savedWalletAddress, getAccessToken]);

  const setUsername = useCallback(async (username: string) => {
    if (!authenticated) return;
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ displayName: username, avatarUrl: privyAvatar }),
      });
      if (res.ok) {
        // Immediately update local state so badge updates
        setProfile((p) => p ? { ...p, displayName: username } : p);
        setNeedsUsername(false);
        // Also re-fetch from Firestore to be safe
        const meRes = await fetch('/api/users/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (meRes.ok) {
          const data = await meRes.json();
          setProfile({
            coins: data.coins,
            displayName: data.displayName || username,
            avatarUrl: data.avatarUrl || privyAvatar || '',
          });
        }
      }
    } catch { /* silent */ }
  }, [authenticated, getAccessToken, privyAvatar]);

  const walletMismatch = !!(
    wallet?.address &&
    savedWalletAddress &&
    wallet.address !== savedWalletAddress
  );

  const value: UserContextValue = {
    user,
    wallet,
    login,
    logout,
    authenticated,
    ready,
    userId,
    profile,
    loadingProfile,
    needsUsername,
    setUsername,
    refreshProfile: fetchProfile,
    getAccessToken,
    savedWalletAddress,
    walletMismatch,
  };

  return React.createElement(UserContext.Provider, { value }, children);
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within UserProvider');
  return ctx;
}
