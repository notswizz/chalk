import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { firestore } from '@/lib/firebase';
import { collection, query, getDocs, orderBy, doc, setDoc } from 'firebase/firestore';
import { trackChallenge } from '@/lib/track-challenge';

export async function GET() {
  try {
    const q = query(
      collection(firestore, 'chalk-cards'),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    const cards = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    return NextResponse.json({ cards });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to fetch chalk cards';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await verifyAuth(req);
    const body = await req.json();

    const { id, userName, betId, player, stat, target, direction, result, gameTitle, format, duration, url } = body;
    if (!id || !url || !betId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const card = {
      id,
      userId,
      userName: userName || 'User',
      betId,
      player: player || '',
      stat: stat || '',
      target: target || 0,
      direction: direction || '',
      result: result || null,
      gameTitle: gameTitle || '',
      format: format || 'story',
      duration: duration || 0,
      url,
      createdAt: Date.now(),
    };

    await setDoc(doc(collection(firestore, 'chalk-cards'), id), card);

    trackChallenge(userId, 'card_shared').catch(() => {});
    trackChallenge(userId, 'chalk_card').catch(() => {});

    return NextResponse.json({ card });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unauthorized';
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
