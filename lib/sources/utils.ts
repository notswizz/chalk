export const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

export function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

export function proxyUrl(rawUrl: string): string {
  return `/api/proxy?url=${encodeURIComponent(rawUrl)}`;
}

export function matchesTeams(text: string, team1: string, team2: string): boolean {
  const norm = normalize(text);
  const t1Words = normalize(team1).split(/\s+/).filter((w) => w.length > 2);
  const t2Words = normalize(team2).split(/\s+/).filter((w) => w.length > 2);
  return t1Words.some((w) => norm.includes(w)) && t2Words.some((w) => norm.includes(w));
}

export async function extractHlsUrl(embedUrl: string, referer: string): Promise<string | null> {
  try {
    const res = await fetch(embedUrl, {
      headers: {
        ...HEADERS,
        Referer: referer,
      },
    });
    if (!res.ok) return null;

    const html = await res.text();

    // Look for base64-encoded source in Clappr config: source: window.atob('...')
    const atobMatch = html.match(/window\.atob\(['"]([A-Za-z0-9+/=]+)['"]\)/);
    if (atobMatch) {
      return Buffer.from(atobMatch[1], 'base64').toString('utf-8');
    }

    // Fallback: look for direct m3u8 URL
    const m3u8Match = html.match(/(https?:\/\/[^\s"']+\.m3u8[^\s"']*)/);
    if (m3u8Match) {
      return m3u8Match[1];
    }

    return null;
  } catch {
    return null;
  }
}
