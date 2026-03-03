import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Buy CHALK',
  description: 'Get CHALK tokens to start betting on player props. Swap SOL for CHALK on pump.fun.',
  openGraph: {
    title: 'Buy CHALK | Chalk',
    description: 'Get CHALK tokens to start betting on player props.',
  },
};

export default function BuyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
