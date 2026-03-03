import type { Metadata, Viewport } from 'next';
import { Permanent_Marker, Patrick_Hand, Indie_Flower } from 'next/font/google';
import './globals.css';
import { TopNav } from '@/components/TopNav';
import { Analytics } from '@vercel/analytics/next';
import { Providers } from './providers';

const chalkHeader = Permanent_Marker({
  weight: '400',
  variable: '--font-chalk-header',
  subsets: ['latin'],
});

const chalkBody = Patrick_Hand({
  weight: '400',
  variable: '--font-chalk-body',
  subsets: ['latin'],
});

const chalkMono = Indie_Flower({
  weight: '400',
  variable: '--font-chalk-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: {
    default: 'Chalk — Live Sports Props on the Board',
    template: '%s | Chalk',
  },
  description: 'Watch live sports, draw up player props, and bet with CHALK tokens. Real games. Real stakes. On the board.',
  manifest: '/manifest.json',
  icons: {
    icon: '/chalk-logo.png',
    apple: '/chalk-logo.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Chalk',
  },
  metadataBase: new URL('https://chalkstreams.live'),
  openGraph: {
    type: 'website',
    siteName: 'Chalk',
    title: 'Chalk — Live Sports Props on the Board',
    description: 'Watch live sports, draw up player props, and bet with CHALK tokens.',
    url: 'https://chalkstreams.live',
    images: [{ url: '/chalk-logo.png', width: 512, height: 512, alt: 'Chalk' }],
  },
  twitter: {
    card: 'summary',
    title: 'Chalk — Live Sports Props on the Board',
    description: 'Watch live sports, draw up player props, and bet with CHALK tokens.',
    images: ['/chalk-logo.png'],
  },
};

export const viewport: Viewport = {
  themeColor: '#1a2a1a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${chalkHeader.variable} ${chalkBody.variable} ${chalkMono.variable} antialiased chalkboard`}
      >
        <div className="chalkboard-texture" />
        {/* Subtle green dust glow behind content */}
        <div className="fixed inset-0 pointer-events-none" aria-hidden>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[#2d4230]/20 rounded-full blur-[120px]" />
        </div>
        <Providers>
          <TopNav />
          <main className="relative min-h-screen">{children}</main>
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
