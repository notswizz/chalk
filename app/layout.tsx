import type { Metadata, Viewport } from 'next';
import { Permanent_Marker, Patrick_Hand, Indie_Flower } from 'next/font/google';
import './globals.css';
import { TopNav } from '@/components/TopNav';
import { Analytics } from '@vercel/analytics/next';
import { Providers } from './providers';
import { ToastProvider } from '@/components/ToastProvider';

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
    default: 'Chalk — Free Live Sports Streaming & Player Props | NBA, NFL, MLB, NHL, NCAA & Soccer',
    template: '%s | Chalk — Live Sports Streams',
  },
  description: 'Watch free live sports streams — NBA, NFL, MLB, NHL, NCAA college basketball, and soccer. Bet on player props, clip highlights, and compete with friends. The best StreamEast & Buffstreams alternative with real-time scores and March Madness coverage.',
  keywords: [
    // General
    'live sports streaming', 'free sports streams', 'sports streaming site',
    'streameast', 'stream east', 'buffstreams', 'buffstream', 'buff streams',
    'crackstreams', 'sportsurge', 'live sports free',
    'chalk streams', 'chalkstreams', 'chalk sports',
    // NBA
    'free NBA streams', 'NBA live stream free', 'nbastreams', 'nba streams',
    'watch NBA live', 'NBA streams free', 'live NBA games',
    'NBA scores today', 'NBA games tonight', 'basketball streams',
    // NCAA
    'NCAA streams', 'college basketball streams', 'March Madness streams',
    'NCAA live stream free', 'watch March Madness free', 'college basketball live',
    'NCAA tournament streams', 'March Madness live free',
    // NFL
    'free NFL streams', 'NFL live stream free', 'nflstreams', 'nfl streams',
    'watch NFL live', 'NFL streams free', 'NFL Sunday streams',
    'NFL Thursday Night Football stream', 'NFL Monday Night Football stream',
    // MLB
    'free MLB streams', 'MLB live stream free', 'mlbstreams', 'mlb streams',
    'watch MLB live', 'baseball streams free', 'MLB games today',
    // NHL
    'free NHL streams', 'NHL live stream free', 'nhlstreams', 'nhl streams',
    'watch NHL live', 'hockey streams free', 'NHL games today',
    // Soccer
    'free soccer streams', 'soccer live stream free', 'football streams',
    'Premier League streams', 'Champions League streams', 'MLS streams',
    'La Liga streams', 'Serie A streams', 'watch soccer free',
    // Features
    'player props', 'sports betting', 'live scores', 'sports clips',
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
    siteName: 'Chalk — Free Live Sports Streams',
    title: 'Chalk — Free Live Sports Streams | NBA, NFL, MLB, NHL, NCAA & Soccer',
    description: 'Watch free live sports streams — NBA, NFL, MLB, NHL, NCAA, and soccer. Bet player props, clip highlights, compete with friends. Better than StreamEast & Buffstreams.',
    url: 'https://chalkstreams.live',
    locale: 'en_US',
    images: [{ url: '/chalk-logo.png', width: 512, height: 512, alt: 'Chalk — Free Live Sports Streaming' }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@chalkstreams',
    title: 'Chalk — Free Live Sports Streams | NBA, NFL, NCAA & More',
    description: 'Watch free live NBA, NFL, MLB, NHL, NCAA & soccer streams. Bet player props with friends. The best free sports streaming platform.',
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
                  description: 'Free live sports streaming with player prop betting. Watch NBA, NFL, MLB, NHL, NCAA, and soccer games live. Bet on player stats with CHALK tokens.',
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
                        text: 'Chalk is a free live sports streaming platform where you can watch NBA, NFL, MLB, NHL, NCAA college basketball, and soccer games. Bet on player props like points, rebounds, assists, and 3-pointers, clip highlights, and compete with friends using CHALK tokens. It\'s the best alternative to StreamEast, Buffstreams, and Crackstreams.',
                      },
                    },
                    {
                      '@type': 'Question',
                      name: 'Is Chalk free to use?',
                      acceptedAnswer: {
                        '@type': 'Answer',
                        text: 'Yes! Chalk is completely free to use. You get 500 CHALK tokens when you sign up, and you can start watching live streams across NBA, NFL, MLB, NHL, NCAA, and soccer — plus bet on player props immediately.',
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
                        text: 'Chalk supports NBA, NFL, MLB, NHL, NCAA college basketball, and soccer streams — all free with real-time scores, player stats, and prop betting. March Madness and playoff coverage included during their respective seasons.',
                      },
                    },
                    {
                      '@type': 'Question',
                      name: 'Is Chalk better than StreamEast or Buffstreams?',
                      acceptedAnswer: {
                        '@type': 'Answer',
                        text: 'Chalk offers a cleaner, ad-free experience with live scores across NBA, NFL, MLB, NHL, NCAA, and soccer. Real-time player prop betting, clip highlights, and leaderboards set it apart. Unlike StreamEast or Buffstreams, Chalk lets you bet on player props and share clips while watching games.',
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
          <ToastProvider>
            <TopNav />
            <main className="relative min-h-screen">{children}</main>
          </ToastProvider>
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
