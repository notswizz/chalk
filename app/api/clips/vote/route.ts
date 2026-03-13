import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { firestore } from '@/lib/firebase';
import { doc, getDoc, setDoc, deleteDoc, runTransaction } from 'firebase/firestore';

/**
 * POST /api/clips/vote
 * Body: { clipId, vote: 'up' | 'down' }
 * Toggle: voting the same direction again removes the vote.
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await verifyAuth(req);
    const { clipId, vote } = await req.json();

    if (!clipId || !['up', 'down'].includes(vote)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const voteDocId = `${userId}_${clipId}`;
    const voteRef = doc(firestore, 'clipVotes', voteDocId);
    const clipRef = doc(firestore, 'clips', clipId);

    let resultVote: string | null = null;

    await runTransaction(firestore, async (tx) => {
      const voteSnap = await tx.get(voteRef);
      const clipSnap = await tx.get(clipRef);

      if (!clipSnap.exists()) throw new Error('Clip not found');

      const clipData = clipSnap.data();
      let upvotes = clipData.upvotes ?? 0;
      let downvotes = clipData.downvotes ?? 0;

      if (voteSnap.exists()) {
        const prev = voteSnap.data().vote;
        if (prev === vote) {
          // Toggle off — remove vote
          tx.delete(voteRef);
          if (vote === 'up') upvotes = Math.max(0, upvotes - 1);
          else downvotes = Math.max(0, downvotes - 1);
          resultVote = null;
        } else {
          // Switch vote direction
          tx.set(voteRef, { userId, clipId, vote, updatedAt: Date.now() });
          if (vote === 'up') {
            upvotes += 1;
            downvotes = Math.max(0, downvotes - 1);
          } else {
            downvotes += 1;
            upvotes = Math.max(0, upvotes - 1);
          }
          resultVote = vote;
        }
      } else {
        // New vote
        tx.set(voteRef, { userId, clipId, vote, updatedAt: Date.now() });
        if (vote === 'up') upvotes += 1;
        else downvotes += 1;
        resultVote = vote;
      }

      tx.update(clipRef, { upvotes, downvotes });
    });

    return NextResponse.json({ vote: resultVote });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Vote failed';
    const status = message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * GET /api/clips/vote?clipIds=id1,id2,id3
 * Returns the current user's votes for the given clip IDs.
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await verifyAuth(req);
    const clipIds = req.nextUrl.searchParams.get('clipIds')?.split(',').filter(Boolean) ?? [];

    if (clipIds.length === 0) {
      return NextResponse.json({ votes: {} });
    }

    const votes: Record<string, string> = {};
    // Fetch in parallel (max 30 at a time)
    const batch = clipIds.slice(0, 30);
    const results = await Promise.all(
      batch.map(async (clipId) => {
        const voteRef = doc(firestore, 'clipVotes', `${userId}_${clipId}`);
        const snap = await getDoc(voteRef);
        return { clipId, vote: snap.exists() ? snap.data().vote : null };
      })
    );

    for (const r of results) {
      if (r.vote) votes[r.clipId] = r.vote;
    }

    return NextResponse.json({ votes });
  } catch {
    return NextResponse.json({ votes: {} });
  }
}
