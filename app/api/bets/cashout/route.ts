import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { firestore } from '@/lib/firebase';
import { doc, getDoc, getDocs, addDoc, updateDoc, collection, query, where, orderBy, limit, runTransaction } from 'firebase/firestore';

interface CashoutProposal {
  id: string;
  betId: string;
  proposerId: string;
  proposerName: string;
  /** Amount the proposer wants to walk away with */
  proposerTake: number;
  /** Amount the other party gets */
  otherTake: number;
  status: 'pending' | 'accepted' | 'denied' | 'countered' | 'expired';
  createdAt: number;
  respondedAt?: number;
}

// GET — fetch active cashout proposals for a bet
export async function GET(req: NextRequest) {
  try {
    const userId = await verifyAuth(req);
    const betId = req.nextUrl.searchParams.get('betId');
    if (!betId) return NextResponse.json({ error: 'betId required' }, { status: 400 });

    const betSnap = await getDoc(doc(firestore, 'bets', betId));
    if (!betSnap.exists()) return NextResponse.json({ error: 'Bet not found' }, { status: 404 });
    const bet = betSnap.data();
    if (bet.creatorId !== userId && bet.takerId !== userId) {
      return NextResponse.json({ error: 'Not a participant' }, { status: 403 });
    }

    const proposalsRef = collection(firestore, 'bets', betId, 'cashouts');
    const q = query(proposalsRef, orderBy('createdAt', 'desc'), limit(20));
    const snap = await getDocs(q);
    const proposals = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    return NextResponse.json({ proposals });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed';
    const status = message.includes('Unauthorized') || message.includes('token') ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

// POST — propose, accept, deny, or counter
export async function POST(req: NextRequest) {
  try {
    const userId = await verifyAuth(req);
    const body = await req.json();
    const { betId, action, proposalId, proposerTake } = body;

    if (!betId) return NextResponse.json({ error: 'betId required' }, { status: 400 });

    const betRef = doc(firestore, 'bets', betId);
    const betSnap = await getDoc(betRef);
    if (!betSnap.exists()) return NextResponse.json({ error: 'Bet not found' }, { status: 404 });
    const bet = betSnap.data();

    if (bet.creatorId !== userId && bet.takerId !== userId) {
      return NextResponse.json({ error: 'Not a participant' }, { status: 403 });
    }
    if (bet.status !== 'matched') {
      return NextResponse.json({ error: 'Bet must be matched to cash out' }, { status: 400 });
    }

    const pool = bet.creatorStake + bet.takerStake;
    const proposalsRef = collection(firestore, 'bets', betId, 'cashouts');

    // === PROPOSE or COUNTER ===
    if (action === 'propose' || action === 'counter') {
      const amount = Number(proposerTake);
      if (!amount || amount < 0 || amount > pool) {
        return NextResponse.json({ error: `Amount must be between 0 and ${pool}` }, { status: 400 });
      }

      // Expire any existing pending proposals
      const pendingQ = query(proposalsRef, where('status', '==', 'pending'), limit(5));
      const pendingSnap = await getDocs(pendingQ);
      for (const d of pendingSnap.docs) {
        await updateDoc(d.ref, { status: action === 'counter' ? 'countered' : 'expired', respondedAt: Date.now() });
      }

      // If countering, mark the specific proposal
      if (action === 'counter' && proposalId) {
        const proposalRef = doc(firestore, 'bets', betId, 'cashouts', proposalId);
        await updateDoc(proposalRef, { status: 'countered', respondedAt: Date.now() });
      }

      const userSnap = await getDoc(doc(firestore, 'users', userId));
      const userName = userSnap.exists() ? (userSnap.data().displayName || 'Anonymous') : 'Anonymous';

      const newProposal = await addDoc(proposalsRef, {
        betId,
        proposerId: userId,
        proposerName: userName,
        proposerTake: amount,
        otherTake: pool - amount,
        status: 'pending',
        createdAt: Date.now(),
      });

      return NextResponse.json({ id: newProposal.id, proposerTake: amount, otherTake: pool - amount });
    }

    // === ACCEPT ===
    if (action === 'accept') {
      if (!proposalId) return NextResponse.json({ error: 'proposalId required' }, { status: 400 });

      const proposalRef = doc(firestore, 'bets', betId, 'cashouts', proposalId);
      const proposalSnap = await getDoc(proposalRef);
      if (!proposalSnap.exists()) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
      const proposal = proposalSnap.data() as CashoutProposal;

      if (proposal.status !== 'pending') {
        return NextResponse.json({ error: 'Proposal is no longer pending' }, { status: 400 });
      }
      if (proposal.proposerId === userId) {
        return NextResponse.json({ error: 'Cannot accept your own proposal' }, { status: 400 });
      }

      // Settle via transaction
      await runTransaction(firestore, async (tx) => {
        const freshBet = await tx.get(betRef);
        if (!freshBet.exists() || freshBet.data().status !== 'matched') {
          throw new Error('Bet is no longer matched');
        }

        const proposerRef = doc(firestore, 'users', proposal.proposerId);
        const accepterRef = doc(firestore, 'users', userId);
        const proposerSnap = await tx.get(proposerRef);
        const accepterSnap = await tx.get(accepterRef);

        if (proposerSnap.exists()) {
          tx.update(proposerRef, { coins: (proposerSnap.data().coins ?? 0) + proposal.proposerTake });
        }
        if (accepterSnap.exists()) {
          tx.update(accepterRef, { coins: (accepterSnap.data().coins ?? 0) + proposal.otherTake });
        }

        tx.update(betRef, {
          status: 'settled',
          result: 'cashout',
          cashoutProposerTake: proposal.proposerTake,
          cashoutOtherTake: proposal.otherTake,
          settledAt: Date.now(),
        });

        tx.update(proposalRef, { status: 'accepted', respondedAt: Date.now() });
      });

      return NextResponse.json({ success: true });
    }

    // === DENY ===
    if (action === 'deny') {
      if (!proposalId) return NextResponse.json({ error: 'proposalId required' }, { status: 400 });
      const proposalRef = doc(firestore, 'bets', betId, 'cashouts', proposalId);
      await updateDoc(proposalRef, { status: 'denied', respondedAt: Date.now() });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed';
    const status = message.includes('Unauthorized') || message.includes('token') ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
