import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { firestore } from '@/lib/firebase';
import { doc, collection, runTransaction } from 'firebase/firestore';
import { ensureUserDoc } from '@/lib/ensure-user';
import {
  CHALK_MINT_ADDRESS,
  CHALK_DECIMALS,
  getOwnerWalletAddress,
  coinsToRaw,
  SOLANA_RPC_URL,
} from '@/lib/solana';
import {
  address,
  createSolanaRpc,
  createKeyPairSignerFromBytes,
  createTransactionMessage,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstruction,
  signTransactionMessageWithSigners,
  getBase64EncodedWireTransaction,
  getBase58Encoder,
} from '@solana/kit';
import {
  getTransferCheckedInstruction,
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstruction,
  TOKEN_2022_PROGRAM_ADDRESS,
} from '@solana-program/token-2022';

export async function POST(req: Request) {
  try {
    const userId = await verifyAuth(req);
    await ensureUserDoc(userId);
    const body = await req.json();
    const { amount, walletAddress } = body;

    if (!amount || amount < 10 || !Number.isInteger(amount)) {
      return NextResponse.json(
        { error: 'Amount must be an integer of at least 10' },
        { status: 400 }
      );
    }
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    const userRef = doc(firestore, 'users', userId);
    const txRef = doc(collection(firestore, 'transactions'));

    // Deduct coins in Firestore
    await runTransaction(firestore, async (firestoreTx) => {
      const userSnap = await firestoreTx.get(userRef);
      if (!userSnap.exists()) throw new Error('User not found');

      const userData = userSnap.data();
      if (userData.coins < amount) throw new Error('Insufficient balance');

      firestoreTx.update(userRef, {
        coins: userData.coins - amount,
      });

      firestoreTx.set(txRef, {
        type: 'withdrawal',
        userId,
        amount,
        walletAddress,
        status: 'pending',
        signature: null,
        createdAt: Date.now(),
      });
    });

    // Send on-chain
    try {
      const privateKeyBase58 = process.env.OWNER_WALLET_PRIVATE_KEY;
      if (!privateKeyBase58) throw new Error('Owner wallet not configured');

      const encoder = getBase58Encoder();
      const keypairBytes = encoder.encode(privateKeyBase58);
      const ownerSigner = await createKeyPairSignerFromBytes(keypairBytes);

      const rpc = createSolanaRpc(SOLANA_RPC_URL);
      const recipientAddress = address(walletAddress);

      // Derive ATAs
      const [ownerAta] = await findAssociatedTokenPda({
        owner: getOwnerWalletAddress(),
        tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
        mint: CHALK_MINT_ADDRESS,
      });
      const [recipientAta] = await findAssociatedTokenPda({
        owner: recipientAddress,
        tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
        mint: CHALK_MINT_ADDRESS,
      });

      // Create ATA for recipient if needed (idempotent)
      const createAtaIx = getCreateAssociatedTokenIdempotentInstruction({
        payer: ownerSigner,
        ata: recipientAta,
        owner: recipientAddress,
        mint: CHALK_MINT_ADDRESS,
      });

      const transferIx = getTransferCheckedInstruction({
        source: ownerAta,
        mint: CHALK_MINT_ADDRESS,
        destination: recipientAta,
        authority: ownerSigner,
        amount: coinsToRaw(amount),
        decimals: CHALK_DECIMALS,
      });

      const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

      const msg = appendTransactionMessageInstruction(
        transferIx,
        appendTransactionMessageInstruction(
          createAtaIx,
          setTransactionMessageLifetimeUsingBlockhash(
            latestBlockhash,
            setTransactionMessageFeePayerSigner(
              ownerSigner,
              createTransactionMessage({ version: 0 })
            )
          )
        )
      );

      const signedTx = await signTransactionMessageWithSigners(msg);
      const base64Tx = getBase64EncodedWireTransaction(signedTx);

      const sendResult = await rpc
        .sendTransaction(base64Tx, { encoding: 'base64' })
        .send();

      const txSignature = String(sendResult);

      // Update transaction doc with signature
      const { updateDoc } = await import('firebase/firestore');
      await updateDoc(txRef, {
        status: 'confirmed',
        signature: txSignature,
      });

      return NextResponse.json({ success: true, signature: txSignature });
    } catch (onChainError) {
      // Refund coins on failure
      await runTransaction(firestore, async (firestoreTx) => {
        const userSnap = await firestoreTx.get(userRef);
        if (!userSnap.exists()) return;
        const userData = userSnap.data();
        firestoreTx.update(userRef, {
          coins: userData.coins + amount,
        });
      });

      const { updateDoc } = await import('firebase/firestore');
      await updateDoc(txRef, {
        status: 'failed',
        error: onChainError instanceof Error ? onChainError.message : 'Unknown error',
      });

      throw onChainError;
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to process withdrawal';
    const status = message.includes('Unauthorized') || message.includes('token')
      ? 401
      : message.includes('Insufficient')
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
