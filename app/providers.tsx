'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';
import { UserProvider } from '@/hooks/useUser';

const solanaConnectors = toSolanaWalletConnectors();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        appearance: {
          theme: 'dark',
          accentColor: '#f5d960',
        },
        loginMethods: ['google'],
        embeddedWallets: {
          solana: { createOnLogin: 'all-users' },
        },
        externalWallets: {
          solana: { connectors: solanaConnectors },
        },
      }}
    >
      <UserProvider>
        {children}
      </UserProvider>
    </PrivyProvider>
  );
}
