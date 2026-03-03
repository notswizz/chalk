import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { firestore } from '@/lib/firebase';
import {
  doc,
  getDoc,
  setDoc,
  getDocs,
  collection,
  query,
  where,
  runTransaction,
} from 'firebase/firestore';

export async function POST(req: NextRequest) {
  let userId: string;
  try {
    userId = await verifyAuth(req);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { streamId, gameId, sourceName, vote } = await req.json();

  if (!streamId || !gameId || !vote) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  if (!['up', 'down', 'none'].includes(vote)) {
    return NextResponse.json({ error: 'Invalid vote' }, { status: 400 });
  }

  try {
    const voteDocRef = doc(firestore, 'stream-votes', streamId);
    const voterRef = doc(firestore, 'stream-votes', streamId, 'voters', userId);

    await runTransaction(firestore, async (tx) => {
      const voteDoc = await tx.get(voteDocRef);
      const voterDoc = await tx.get(voterRef);

      const existing = voterDoc.exists() ? voterDoc.data()?.vote : null;

      let upDelta = 0;
      let downDelta = 0;

      // Remove old vote
      if (existing === 'up') upDelta--;
      if (existing === 'down') downDelta--;

      // Toggle: same vote again = remove, otherwise apply new
      const newVote = existing === vote ? 'none' : vote;

      if (newVote === 'up') upDelta++;
      if (newVote === 'down') downDelta++;

      const current = voteDoc.exists()
        ? voteDoc.data()!
        : { streamId, gameId, sourceName: sourceName || '', upvotes: 0, downvotes: 0, score: 0 };

      const upvotes = Math.max(0, (current.upvotes || 0) + upDelta);
      const downvotes = Math.max(0, (current.downvotes || 0) + downDelta);

      tx.set(voteDocRef, {
        streamId,
        gameId,
        sourceName: sourceName || '',
        upvotes,
        downvotes,
        score: upvotes - downvotes,
      });

      if (newVote === 'none') {
        tx.delete(voterRef);
      } else {
        tx.set(voterRef, { vote: newVote, votedAt: Date.now() });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Vote error:', err);
    return NextResponse.json({ error: 'Vote failed' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const gameId = req.nextUrl.searchParams.get('gameId');
  const userId = req.nextUrl.searchParams.get('userId');

  if (!gameId) {
    return NextResponse.json({ error: 'Missing gameId' }, { status: 400 });
  }

  try {
    // Get all vote docs for this game
    const votesRef = collection(firestore, 'stream-votes');
    const q = query(votesRef, where('gameId', '==', gameId));
    const snap = await getDocs(q);

    const votes: Record<string, { upvotes: number; downvotes: number; score: number }> = {};
    const streamIds: string[] = [];

    snap.forEach((d) => {
      const data = d.data();
      votes[d.id] = {
        upvotes: data.upvotes || 0,
        downvotes: data.downvotes || 0,
        score: data.score || 0,
      };
      streamIds.push(d.id);
    });

    // Get user's votes if userId provided
    const userVotes: Record<string, 'up' | 'down'> = {};
    if (userId && streamIds.length > 0) {
      for (const sid of streamIds) {
        const voterDoc = await getDoc(doc(firestore, 'stream-votes', sid, 'voters', userId));
        if (voterDoc.exists()) {
          userVotes[sid] = voterDoc.data().vote;
        }
      }
    }

    return NextResponse.json({ votes, userVotes });
  } catch (err) {
    console.error('Fetch votes error:', err);
    return NextResponse.json({ votes: {}, userVotes: {} });
  }
}
