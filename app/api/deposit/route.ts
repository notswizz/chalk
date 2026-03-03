import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { firestore } from '@/lib/firebase';
import { doc, runTransaction, getDoc } from 'firebase/firestore';
import { ensureUserDoc } from '@/lib/ensure-user';
import {
  CHALK_MINT,
  OWNER_WALLET,
  CHALK_DECIMALS,
  SOLANA_RPC_URL,
} from '@/lib/solana';

export async function POST(req: Request) {
  try {
    const userId = await verifyAuth(req);
    await ensureUserDoc(userId);
    const body = await req.json();
    const { signature, expectedAmount } = body;

    if (!signature || !expectedAmount || expectedAmount <= 0) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    // Idempotency check
    const txRef = doc(firestore, 'transactions', signature);
    const existing = await getDoc(txRef);
    if (existing.exists()) {
      return NextResponse.json({ error: 'Transaction already processed' }, { status: 409 });
    }

    // Fetch transaction from chain
    const rpcResponse = await fetch(SOLANA_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTransaction',
        params: [
          signature,
          { encoding: 'jsonParsed', commitment: 'confirmed', maxSupportedTransactionVersion: 0 },
        ],
      }),
    });

    const rpcResult = await rpcResponse.json();
    const tx = rpcResult.result;

    if (!tx) {
      // Transaction not confirmed yet — client should retry
      return NextResponse.json({ error: 'Transaction not found yet' }, { status: 202 });
    }

    if (tx.meta?.err) {
      return NextResponse.json({ error: 'Transaction failed on-chain' }, { status: 400 });
    }

    // Verify the deposit using preTokenBalances / postTokenBalances
    const pre = tx.meta.preTokenBalances || [];
    const post = tx.meta.postTokenBalances || [];

    // Find the owner's CHALK balance change
    // Solana addresses are base58 and case-sensitive — exact match only
    let depositAmount = 0;

    for (const postEntry of post) {
      if (
        postEntry.mint === CHALK_MINT &&
        postEntry.owner === OWNER_WALLET
      ) {
        const postAmount = BigInt(postEntry.uiTokenAmount.amount);
        const preEntry = pre.find(
          (p: { accountIndex: number; mint: string; owner?: string }) =>
            p.accountIndex === postEntry.accountIndex &&
            p.mint === CHALK_MINT
        );
        const preAmount = preEntry ? BigInt(preEntry.uiTokenAmount.amount) : BigInt(0);
        const diff = postAmount - preAmount;
        if (diff > BigInt(0)) {
          depositAmount = Number(diff) / 10 ** CHALK_DECIMALS;
        }
        break;
      }
    }

    if (depositAmount <= 0) {
      return NextResponse.json(
        { error: 'No CHALK deposit to owner wallet found in transaction' },
        { status: 400 }
      );
    }

    if (Math.abs(depositAmount - expectedAmount) > 0.001) {
      return NextResponse.json(
        { error: `Amount mismatch: found ${depositAmount}, expected ${expectedAmount}` },
        { status: 400 }
      );
    }

    const coinAmount = Math.floor(depositAmount);
    if (coinAmount <= 0) {
      return NextResponse.json({ error: 'Deposit too small' }, { status: 400 });
    }

    // Credit coins in Firestore transaction
    const userRef = doc(firestore, 'users', userId);
    await runTransaction(firestore, async (firestoreTx) => {
      const userSnap = await firestoreTx.get(userRef);
      if (!userSnap.exists()) throw new Error('User not found');

      // Check idempotency inside transaction
      const txSnap = await firestoreTx.get(txRef);
      if (txSnap.exists()) throw new Error('Already processed');

      const userData = userSnap.data();
      firestoreTx.update(userRef, {
        coins: userData.coins + coinAmount,
      });

      firestoreTx.set(txRef, {
        type: 'deposit',
        userId,
        signature,
        amount: coinAmount,
        status: 'confirmed',
        createdAt: Date.now(),
      });
    });

    return NextResponse.json({ success: true, amount: coinAmount });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to process deposit';
    const status = message.includes('Unauthorized') || message.includes('token') ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
