import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Buy CHALK Tokens — Start Betting on NBA Player Props',
  description: 'Get CHALK tokens to bet on live NBA player props. Swap SOL for CHALK on pump.fun and start betting on points, rebounds, assists, and 3-pointers during live games.',
  openGraph: {
    title: 'Buy CHALK Tokens | Chalk',
    description: 'Get CHALK tokens to bet on live NBA player props. Swap SOL for CHALK on pump.fun.',
  },
};

export default function BuyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
