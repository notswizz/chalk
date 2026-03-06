import { Metadata } from 'next';
import { fetchGameById } from '@/lib/espn';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;

  try {
    const game = await fetchGameById(id);
    if (game) {
      const title = `${game.awayTeam.abbreviation} vs ${game.homeTeam.abbreviation} Live Stream Free`;
      const fullTitle = `${game.awayTeam.displayName} vs ${game.homeTeam.displayName}`;
      const stateLabel = game.state === 'in' ? 'LIVE NOW' : game.state === 'post' ? 'Final Score' : 'Watch Free';
      const description = `${stateLabel} — ${fullTitle} live stream free. Watch ${game.awayTeam.abbreviation} vs ${game.homeTeam.abbreviation} online, live scores, box scores, and bet on ${game.awayTeam.displayName} & ${game.homeTeam.displayName} player props. Best free NBA streaming alternative to StreamEast, Buffstreams, and Crackstreams.`;
      return {
        title,
        description,
        keywords: [
          `${game.awayTeam.displayName} vs ${game.homeTeam.displayName}`,
          `${game.awayTeam.displayName} live stream free`,
          `${game.homeTeam.displayName} live stream free`,
          `watch ${game.awayTeam.displayName} game free`,
          `watch ${game.homeTeam.displayName} game free`,
          `${game.awayTeam.abbreviation} vs ${game.homeTeam.abbreviation} live`,
          `${game.awayTeam.abbreviation} vs ${game.homeTeam.abbreviation} stream`,
          'NBA live stream free', 'watch NBA free', 'free NBA streams',
          'NBA player props', 'streameast', 'buffstreams', 'crackstreams',
        ],
        alternates: {
          canonical: `https://chalkstreams.live/game/${id}`,
        },
        openGraph: {
          title: `${game.awayTeam.abbreviation} vs ${game.homeTeam.abbreviation} Live Stream | Chalk`,
          description: `Watch ${fullTitle} live stream free with real-time scores and player prop betting.`,
          images: game.homeTeam.logo ? [{ url: game.homeTeam.logo, width: 128, height: 128 }] : [],
        },
        twitter: {
          card: 'summary',
          title: `${game.awayTeam.abbreviation} vs ${game.homeTeam.abbreviation} Live Stream | Chalk`,
          description: `Watch ${fullTitle} live stream free on Chalk. Live scores + player prop betting.`,
        },
      };
    }
  } catch {
    // fall through
  }

  return {
    title: 'NBA Live Stream Free — Watch NBA Games Online',
    description: 'Watch free live NBA streams with real-time scores and player prop betting on Chalk. Best StreamEast and Buffstreams alternative.',
  };
}

export default async function GameLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let jsonLd = null;

  try {
    const game = await fetchGameById(id);
    if (game) {
      const fullTitle = `${game.awayTeam.displayName} vs ${game.homeTeam.displayName}`;
      const eventStatus = game.state === 'in'
        ? 'https://schema.org/EventScheduled'
        : game.state === 'post'
          ? 'https://schema.org/EventCompleted'
          : 'https://schema.org/EventScheduled';

      jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'SportsEvent',
        name: fullTitle,
        description: `Watch ${fullTitle} live stream free on Chalk. Live scores, player stats, and prop betting.`,
        url: `https://chalkstreams.live/game/${id}`,
        eventStatus,
        eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
        startDate: game.date,
        location: {
          '@type': 'VirtualLocation',
          url: `https://chalkstreams.live/game/${id}`,
        },
        sport: 'Basketball',
        homeTeam: {
          '@type': 'SportsTeam',
          name: game.homeTeam.displayName,
          logo: game.homeTeam.logo,
        },
        awayTeam: {
          '@type': 'SportsTeam',
          name: game.awayTeam.displayName,
          logo: game.awayTeam.logo,
        },
        organizer: {
          '@type': 'Organization',
          name: 'NBA',
          url: 'https://www.nba.com',
        },
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
          url: `https://chalkstreams.live/game/${id}`,
          description: 'Free live stream with player prop betting',
        },
        isAccessibleForFree: true,
        ...(game.venue ? { location: { '@type': 'Place', name: game.venue } } : {}),
      };
    }
  } catch {
    // no JSON-LD
  }

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {children}
    </>
  );
}
