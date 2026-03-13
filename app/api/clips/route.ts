import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { firestore } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, doc, setDoc } from 'firebase/firestore';
import { trackChallenge } from '@/lib/track-challenge';

export async function GET(req: NextRequest) {
  try {
    const gameId = req.nextUrl.searchParams.get('gameId');
    const sort = req.nextUrl.searchParams.get('sort') || 'recent'; // 'recent' | 'upvotes'
    const time = req.nextUrl.searchParams.get('time'); // '1d' | '1w' | '1m' | null (all)

    const constraints: ReturnType<typeof where>[] = [];

    if (gameId) {
      constraints.push(where('gameId', '==', gameId));
    }

    if (time) {
      const now = Date.now();
      const cutoffs: Record<string, number> = {
        '1d': now - 24 * 60 * 60 * 1000,
        '1w': now - 7 * 24 * 60 * 60 * 1000,
        '1m': now - 30 * 24 * 60 * 60 * 1000,
      };
      if (cutoffs[time]) {
        constraints.push(where('createdAt', '>=', cutoffs[time]));
      }
    }

    // Firestore requires orderBy on the field used in range filter
    const ob = sort === 'upvotes'
      ? orderBy('upvotes', 'desc')
      : orderBy('createdAt', 'desc');

    // When filtering by time AND sorting by upvotes, Firestore needs createdAt index first
    // So we always fetch ordered by createdAt when time filter is active, then sort client-side
    const needsClientSort = sort === 'upvotes' && time;

    const q = query(
      collection(firestore, 'clips'),
      ...constraints,
      needsClientSort ? orderBy('createdAt', 'desc') : ob,
    );

    const snap = await getDocs(q);
    let clips = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    if (needsClientSort) {
      clips.sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
        ((b.upvotes as number) ?? 0) - ((a.upvotes as number) ?? 0)
      );
    }

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
