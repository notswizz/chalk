import * as cheerio from 'cheerio';
import { StreamLink } from '../types';
import { StreamSource } from './types';
import { HEADERS, normalize, proxyUrl, extractHlsUrl } from './utils';

const BASE_URL = 'https://sportsurge.ws';

const SPORT_PATHS: Record<string, string> = {
  nba: '/nba/livestreams2',
  ncaam: '/ncaa/livestreams2',
  nfl: '/nfl/livestreams2',
  mlb: '/mlb/livestreams2',
  nhl: '/nhl/livestreams2',
  soccer: '/soccer/livestreams2',
};

/**
 * Find the game page URL from the sport listing page by matching team names.
 */
async function findGameUrl(
  sport: string,
  team1: string,
  team2: string
): Promise<string | null> {
  const path = SPORT_PATHS[sport];
  if (!path) return null;

  const res = await fetch(`${BASE_URL}${path}`, { headers: HEADERS });
  if (!res.ok) return null;

  const html = await res.text();
  const $ = cheerio.load(html);

  const team1Words = normalize(team1).split(/\s+/).filter((w) => w.length > 2);
  const team2Words = normalize(team2).split(/\s+/).filter((w) => w.length > 2);

  let bestMatch: string | null = null;

  $('a[href*="/watch/"]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;

    const linkText = normalize($(el).text() + ' ' + href);
    const team1Match = team1Words.some((w) => linkText.includes(w));
    const team2Match = team2Words.some((w) => linkText.includes(w));

    if (team1Match && team2Match) {
      bestMatch = href.startsWith('http') ? href : `${BASE_URL}${href}`;
    }
  });

  return bestMatch;
}

/**
 * Scrape the game page for stream IDs, then resolve each to an HLS URL.
 */
async function scrapeGamePage(gameUrl: string): Promise<StreamLink[]> {
  const res = await fetch(gameUrl, { headers: HEADERS });
  if (!res.ok) return [];

  const html = await res.text();
  const $ = cheerio.load(html);

  const streamEntries: { id: string; label: string }[] = [];

  const mainIframeSrc = $('#cx-iframe').attr('src') || $('iframe.embed-responsive-item').attr('src');

  $('[onclick*="changeStream"]').each((_, el) => {
    const onclick = $(el).attr('onclick') || '';
    const match = onclick.match(/changeStream\((\d+)\)/);
    if (match) {
      streamEntries.push({
        id: match[1],
        label: $(el).text().trim(),
      });
    }
  });

  if (streamEntries.length === 0 && mainIframeSrc) {
    const idMatch = mainIframeSrc.match(/\/(\d+)$/);
    if (idMatch) {
      streamEntries.push({ id: idMatch[1], label: 'Server 1' });
    }
  }

  const embedBase = mainIframeSrc
    ? mainIframeSrc.replace(/\/\d+$/, '')
    : 'https://gooz.aapmains.net/new-stream-embed';

  const streams: StreamLink[] = [];
  let serverNum = 1;

  for (const entry of streamEntries) {
    const embedUrl = `${embedBase}/${entry.id}`;
    const hlsUrl = await extractHlsUrl(embedUrl, `${BASE_URL}/`);

    if (hlsUrl) {
      streams.push({
        url: proxyUrl(hlsUrl),
        source: entry.label || `Server ${serverNum}`,
        quality: 'HD',
        type: 'hls',
        sourceName: 'Sportsurge',
      });
    }
    serverNum++;
  }

  return streams;
}

export const sportsurge: StreamSource = {
  name: 'Sportsurge',
  async getStreams(sport: string, team1: string, team2: string): Promise<StreamLink[]> {
    try {
      const gameUrl = await findGameUrl(sport, team1, team2);
      if (!gameUrl) return [];
      return await scrapeGamePage(gameUrl);
    } catch {
      return [];
    }
  },
};
