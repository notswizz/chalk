'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';
import { UserProvider } from '@/hooks/useUser';
import { ChalkPriceProvider } from '@/hooks/useChalkPrice';
import { useEffect, useState } from 'react';

const solanaConnectors = toSolanaWalletConnectors();

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // During SSR/prerender, render children without providers to avoid
  // Privy crash when NEXT_PUBLIC_PRIVY_APP_ID is unavailable
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        appearance: {
          theme: 'dark',
          accentColor: '#f5d960',
        },
        loginMethods: ['wallet', 'google'],
        embeddedWallets: {
          solana: { createOnLogin: 'off' },
        },
        externalWallets: {
          solana: { connectors: solanaConnectors },
        },
      }}
    >
      <ChalkPriceProvider>
        <UserProvider>
          {children}
        </UserProvider>
      </ChalkPriceProvider>
    </PrivyProvider>
  );
}
