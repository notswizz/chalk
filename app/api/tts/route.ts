import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { EdgeTTS } from '@andresaya/edge-tts';

const VOICES = [
  'en-US-GuyNeural',
  'en-GB-RyanNeural',
  'en-US-AriaNeural',
  'en-AU-WilliamNeural',
];

export async function POST(req: Request) {
  try {
    await verifyAuth(req);

    const body = await req.json();
    const text = (body.text || '').trim();
    if (!text || text.length > 280) {
      return NextResponse.json({ error: 'Text required (max 280 chars)' }, { status: 400 });
    }

    const voice = VOICES.includes(body.voice)
      ? body.voice
      : VOICES[Math.floor(Math.random() * VOICES.length)];

    const tts = new EdgeTTS();
    await tts.synthesize(text, voice);
    const buffer = tts.toBuffer();
    const bytes = new Uint8Array(buffer);

    return new Response(bytes, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': bytes.length.toString(),
        'X-TTS-Voice': voice,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'TTS generation failed';
    console.error('TTS error:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
