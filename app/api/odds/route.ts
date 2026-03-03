import { NextResponse } from 'next/server';
import { getNBAOdds, getNBASpreads, KalshiMarket } from '@/lib/kalshi';

let cache: { markets: KalshiMarket[]; spreads: KalshiMarket[]; ts: number } | null = null;
const CACHE_TTL = 60_000;

export async function GET() {
  const now = Date.now();

  if (!cache || now - cache.ts > CACHE_TTL) {
    try {
      const [markets, spreads] = await Promise.all([getNBAOdds(), getNBASpreads()]);
      cache = { markets, spreads, ts: now };
    } catch {
      return NextResponse.json({ markets: [], spreads: [] });
    }
  }

  return NextResponse.json({ markets: cache.markets, spreads: cache.spreads });
}
