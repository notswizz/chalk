import { createHash } from 'crypto';
import { StreamLink } from '../types';
import { StreamSource } from './types';
import { buffstreams } from './buffstreams';
import { sportsurge } from './sportsurge';

export type { StreamSource };

const sources: StreamSource[] = [buffstreams, sportsurge];

export async function findStreams(
  sport: string,
  team1: string,
  team2: string,
  gameId?: string
): Promise<StreamLink[]> {
  const results = await Promise.allSettled(
    sources.map((s) => s.getStreams(sport, team1, team2))
  );

  const all = results
    .filter((r) => r.status === 'fulfilled')
    .flatMap((r) => (r as PromiseFulfilledResult<StreamLink[]>).value);

  // Deduplicate streams with identical proxy URLs (same HLS source from different scrapers)
  const seen = new Set<string>();
  const deduped: StreamLink[] = [];
  for (const stream of all) {
    // Extract the raw URL from the proxy wrapper for dedup comparison
    const rawUrl = decodeURIComponent(stream.url.replace(/^.*\?url=/, ''));
    if (seen.has(rawUrl)) continue;
    seen.add(rawUrl);
    deduped.push(stream);
  }

  // Assign deterministic IDs if gameId provided
  if (gameId) {
    for (const stream of deduped) {
      const hash = createHash('md5').update(stream.url).digest('hex').slice(0, 8);
      stream.id = `${gameId}:${stream.sourceName || 'unknown'}:${hash}`;
    }
  }

  return deduped;
}
