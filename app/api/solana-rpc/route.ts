import { NextResponse } from 'next/server';
import { SOLANA_RPC_URL } from '@/lib/solana';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const res = await fetch(SOLANA_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'RPC request failed' }, { status: 500 });
  }
}
