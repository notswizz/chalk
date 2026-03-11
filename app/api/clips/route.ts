import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { firestore } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, doc, setDoc } from 'firebase/firestore';
import { trackChallenge } from '@/lib/track-challenge';

export async function GET(req: NextRequest) {
  try {
    const gameId = req.nextUrl.searchParams.get('gameId');

    let q;
    if (gameId) {
      q = query(
        collection(firestore, 'clips'),
        where('gameId', '==', gameId),
        orderBy('createdAt', 'desc')
      );
    } else {
      q = query(
        collection(firestore, 'clips'),
        orderBy('createdAt', 'desc')
      );
    }

    const snap = await getDocs(q);
    const clips = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    return NextResponse.json({ clips });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to fetch clips';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const userId = await verifyAuth(req);
    const body = await req.json();

    const { id, clipTitle, userName, gameId, gameTitle, sport, duration, url } = body;
    if (!id || !url) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const clip = {
      id,
      clipTitle: clipTitle || '',
      userId,
      userName: userName || 'User',
      gameId,
      gameTitle: gameTitle || '',
      sport: sport || 'nba',
      duration: duration || 0,
      url,
      createdAt: Date.now(),
    };

    await setDoc(doc(collection(firestore, 'clips'), id), clip);

    trackChallenge(userId, 'clip_created').catch(() => {});

    return NextResponse.json({ clip });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unauthorized';
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
