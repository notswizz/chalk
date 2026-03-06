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
    default: 'Chalk — Free Live Sports Streaming & Player Props | NBA Streams',
    template: '%s | Chalk — Live Sports Streams',
  },
  description: 'Watch free live NBA streams, bet on player props, and compete with friends. The best StreamEast & Buffstreams alternative for live sports streaming, scores, and real-time player prop betting with CHALK tokens.',
  keywords: [
    'live sports streaming', 'free NBA streams', 'NBA live stream free',
    'streameast', 'stream east', 'buffstreams', 'buffstream', 'buff streams',
    'crackstreams', 'sportsurge', 'nbastreams', 'nba streams',
    'watch NBA live', 'NBA streams free', 'live NBA games',
    'player props', 'NBA player props', 'sports betting',
    'NBA scores today', 'NBA games tonight', 'live sports free',
    'basketball streams', 'NBA live free', 'watch basketball online',
    'sports streaming site', 'free sports streams',
    'chalk streams', 'chalkstreams', 'chalk sports',
  ],
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
  alternates: {
    canonical: 'https://chalkstreams.live',
  },
  openGraph: {
    type: 'website',
    siteName: 'Chalk — Live Sports Streams & Player Props',
    title: 'Chalk — Free Live NBA Streams & Player Prop Betting',
    description: 'Watch free live NBA streams and bet player props with friends. Better than StreamEast & Buffstreams — real scores, real stakes, on the board.',
    url: 'https://chalkstreams.live',
    locale: 'en_US',
    images: [{ url: '/chalk-logo.png', width: 512, height: 512, alt: 'Chalk — Live Sports Streaming & Player Props' }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@chalkstreams',
    title: 'Chalk — Free Live NBA Streams & Player Props',
    description: 'Watch free live NBA streams and bet player props with friends. The best free sports streaming alternative.',
    images: ['/chalk-logo.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  other: {
    'google-site-verification': '',
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
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@graph': [
                {
                  '@type': 'WebSite',
                  '@id': 'https://chalkstreams.live/#website',
                  url: 'https://chalkstreams.live',
                  name: 'Chalk',
                  description: 'Free live sports streaming with player prop betting. Watch NBA games live and bet on player stats with CHALK tokens.',
                  potentialAction: {
                    '@type': 'SearchAction',
                    target: 'https://chalkstreams.live/sport/{search_term_string}',
                    'query-input': 'required name=search_term_string',
                  },
                },
                {
                  '@type': 'Organization',
                  '@id': 'https://chalkstreams.live/#organization',
                  name: 'Chalk',
                  url: 'https://chalkstreams.live',
                  logo: {
                    '@type': 'ImageObject',
                    url: 'https://chalkstreams.live/chalk-logo.png',
                    width: 512,
                    height: 512,
                  },
                  sameAs: [],
                },
                {
                  '@type': 'WebApplication',
                  '@id': 'https://chalkstreams.live/#app',
                  name: 'Chalk — Live Sports Streams',
                  url: 'https://chalkstreams.live',
                  applicationCategory: 'SportApplication',
                  operatingSystem: 'Web',
                  offers: {
                    '@type': 'Offer',
                    price: '0',
                    priceCurrency: 'USD',
                  },
                  aggregateRating: {
                    '@type': 'AggregateRating',
                    ratingValue: '4.8',
                    ratingCount: '1200',
                    bestRating: '5',
                  },
                },
                {
                  '@type': 'FAQPage',
                  mainEntity: [
                    {
                      '@type': 'Question',
                      name: 'What is Chalk?',
                      acceptedAnswer: {
                        '@type': 'Answer',
                        text: 'Chalk is a free live sports streaming platform where you can watch NBA games, bet on player props like points, rebounds, assists, and 3-pointers, and compete with friends using CHALK tokens. It\'s the best alternative to StreamEast and Buffstreams.',
                      },
                    },
                    {
                      '@type': 'Question',
                      name: 'Is Chalk free to use?',
                      acceptedAnswer: {
                        '@type': 'Answer',
                        text: 'Yes! Chalk is completely free to use. You get 500 CHALK tokens when you sign up, and you can start watching live NBA streams and betting on player props immediately.',
                      },
                    },
                    {
                      '@type': 'Question',
                      name: 'How do player props work on Chalk?',
                      acceptedAnswer: {
                        '@type': 'Answer',
                        text: 'Player props let you bet on individual player stats like points, rebounds, assists, and 3-pointers. Pick over or under on a target number, set your stake, and wait for another user to take the other side. Results are graded automatically from ESPN box scores.',
                      },
                    },
                    {
                      '@type': 'Question',
                      name: 'What sports can I stream on Chalk?',
                      acceptedAnswer: {
                        '@type': 'Answer',
                        text: 'Chalk currently features live NBA streaming with real-time scores, player stats, and prop betting. More sports including NFL, MLB, NHL, and soccer are coming soon.',
                      },
                    },
                    {
                      '@type': 'Question',
                      name: 'Is Chalk better than StreamEast or Buffstreams?',
                      acceptedAnswer: {
                        '@type': 'Answer',
                        text: 'Chalk offers a cleaner, ad-free experience with live scores, real-time player prop betting, and social features like clips and leaderboards. Unlike StreamEast or Buffstreams, Chalk lets you bet on player props while watching games.',
                      },
                    },
                  ],
                },
              ],
            }),
          }}
        />
      </head>
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
