import { NextResponse } from 'next/server';

const DEXSCREENER_URL =
  'https://api.dexscreener.com/tokens/v1/solana/4khj2EMrS97s6LyWdSiga2yne74TfpbodFjd69mXpump';

let cached: { price: number; ts: number } | null = null;
const CACHE_TTL = 15_000; // 15 seconds

export async function GET() {
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(
      { price: cached.price },
      { headers: { 'Cache-Control': 'public, max-age=15' } },
    );
  }

  try {
    const res = await fetch(DEXSCREENER_URL, { next: { revalidate: 15 } });
    const data = await res.json();
    const priceUsd = parseFloat(data?.[0]?.priceUsd);

    if (isNaN(priceUsd)) {
      return NextResponse.json({ price: null }, { status: 502 });
    }

    cached = { price: priceUsd, ts: Date.now() };

    return NextResponse.json(
      { price: priceUsd },
      { headers: { 'Cache-Control': 'public, max-age=15' } },
    );
  } catch {
    return NextResponse.json({ price: null }, { status: 502 });
  }
}
