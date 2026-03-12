import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { firestore } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, addDoc, query, orderBy, limit } from 'firebase/firestore';

export async function GET(req: NextRequest) {
  try {
    const userId = await verifyAuth(req);
    const betId = req.nextUrl.searchParams.get('betId');
    if (!betId) return NextResponse.json({ error: 'betId required' }, { status: 400 });

    // Verify user is a participant
    const betSnap = await getDoc(doc(firestore, 'bets', betId));
    if (!betSnap.exists()) return NextResponse.json({ error: 'Bet not found' }, { status: 404 });
    const bet = betSnap.data();
    if (bet.creatorId !== userId && bet.takerId !== userId) {
      return NextResponse.json({ error: 'Not a participant' }, { status: 403 });
    }

    const msgsRef = collection(firestore, 'bets', betId, 'messages');
    const q = query(msgsRef, orderBy('createdAt', 'asc'), limit(100));
    const snap = await getDocs(q);
    const messages = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    return NextResponse.json({ messages });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to fetch messages';
    const status = message.includes('Unauthorized') || message.includes('token') ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await verifyAuth(req);
    const { betId, text } = await req.json();
    if (!betId || !text?.trim()) {
      return NextResponse.json({ error: 'betId and text required' }, { status: 400 });
    }

    // Verify user is a participant
    const betSnap = await getDoc(doc(firestore, 'bets', betId));
    if (!betSnap.exists()) return NextResponse.json({ error: 'Bet not found' }, { status: 404 });
    const bet = betSnap.data();
    if (bet.creatorId !== userId && bet.takerId !== userId) {
      return NextResponse.json({ error: 'Not a participant' }, { status: 403 });
    }

    const senderName = userId === bet.creatorId ? bet.creatorName : bet.takerName;

    const msgsRef = collection(firestore, 'bets', betId, 'messages');
    const msgDoc = await addDoc(msgsRef, {
      senderId: userId,
      senderName: senderName || 'Anonymous',
      text: text.trim().slice(0, 500),
      createdAt: Date.now(),
    });

    return NextResponse.json({ id: msgDoc.id });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to send message';
    const status = message.includes('Unauthorized') || message.includes('token') ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
