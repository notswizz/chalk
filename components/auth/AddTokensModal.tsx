'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useUser } from '@/hooks/useUser';
import { useSignAndSendTransaction } from '@privy-io/react-auth/solana';
import {
  createTransactionMessage,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  compileTransaction,
  getTransactionEncoder,
  createNoopSigner,
  address,
} from '@solana/kit';
import {
  getTransferCheckedInstruction,
  getCreateAssociatedTokenIdempotentInstruction,
  findAssociatedTokenPda,
  TOKEN_2022_PROGRAM_ADDRESS,
} from '@solana-program/token-2022';
import { useChalkPrice, formatUsd } from '@/hooks/useChalkPrice';
import {
  CHALK_MINT,
  CHALK_MINT_ADDRESS,
  CHALK_DECIMALS,
  OWNER_WALLET_ADDRESS,
  coinsToRaw,
} from '@/lib/solana';

const PRESET_AMOUNTS = [100, 500, 1000];

export function AddTokensModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const { getAccessToken, wallet } = useUser();
  const { price } = useChalkPrice();
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const [amount, setAmount] = useState('500');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [onChainBalance, setOnChainBalance] = useState<number | null>(null);

  const walletAddress = wallet?.address || '';

  const fetchBalance = useCallback(async () => {
    if (!walletAddress) return;
    try {
      // Use direct RPC fetch — more reliable than kit wrapper
      const res = await fetch('/api/solana-rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getTokenAccountsByOwner',
          params: [
            walletAddress,
            { mint: CHALK_MINT },
            { encoding: 'jsonParsed' },
          ],
        }),
      });
      const data = await res.json();
      const accounts = data.result?.value || [];
      if (accounts.length > 0) {
        const parsed = accounts[0].account.data.parsed.info;
        const amt = Number(parsed.tokenAmount.uiAmount ?? 0);
        setOnChainBalance(amt);
      } else {
        setOnChainBalance(0);
      }
    } catch (e) {
      console.error('[Deposit] Balance fetch failed:', e);
      setOnChainBalance(0);
    }
  }, [walletAddress]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  async function handleDeposit() {
    const numAmount = parseInt(amount, 10);
    if (!numAmount || numAmount <= 0) {
      setError('Enter a valid amount');
      return;
    }
    if (!wallet) {
      setError('No wallet connected');
      return;
    }

    setLoading(true);
    setError('');
    setStatus('Sending...');

    try {
      const userAddr = address(walletAddress);
      const noopSigner = createNoopSigner(userAddr);

      // Derive ATAs
      const [userAta] = await findAssociatedTokenPda({
        owner: userAddr,
        tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
        mint: CHALK_MINT_ADDRESS,
      });
      const [ownerAta] = await findAssociatedTokenPda({
        owner: OWNER_WALLET_ADDRESS,
        tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
        mint: CHALK_MINT_ADDRESS,
      });

      // Create owner ATA if needed (idempotent) — user pays
      const createAtaIx = getCreateAssociatedTokenIdempotentInstruction({
        payer: noopSigner,
        ata: ownerAta,
        owner: OWNER_WALLET_ADDRESS,
        mint: CHALK_MINT_ADDRESS,
      });

      const transferIx = getTransferCheckedInstruction({
        source: userAta,
        mint: CHALK_MINT_ADDRESS,
        destination: ownerAta,
        authority: noopSigner,
        amount: coinsToRaw(numAmount),
        decimals: CHALK_DECIMALS,
      });

      // Fetch blockhash through proxy to avoid CORS
      const bhRes = await fetch('/api/solana-rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 1,
          method: 'getLatestBlockhash',
          params: [{ commitment: 'confirmed' }],
        }),
      });
      const bhData = await bhRes.json();
      const latestBlockhash = bhData.result.value;

      const msg = appendTransactionMessageInstructions(
        [createAtaIx, transferIx],
        setTransactionMessageLifetimeUsingBlockhash(
          latestBlockhash,
          setTransactionMessageFeePayerSigner(
            noopSigner,
            createTransactionMessage({ version: 0 })
          )
        )
      );

      const compiled = compileTransaction(msg);
      const encoder = getTransactionEncoder();
      const txBytes = encoder.encode(compiled);

      // Sign and send via Privy
      const result = await signAndSendTransaction({
        transaction: new Uint8Array(txBytes),
        wallet,
        chain: 'solana:mainnet',
      });

      const sigBytes = result.signature;
      // Convert signature bytes to base58 string
      const { getBase58Decoder } = await import('@solana/kit');
      const sigString = getBase58Decoder().decode(sigBytes);

      // Verify deposit on backend
      setStatus('Verifying...');
      const token = await getAccessToken();

      let verified = false;
      for (let i = 0; i < 10; i++) {
        const res = await fetch('/api/deposit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ signature: sigString, expectedAmount: numAmount }),
        });

        if (res.ok) {
          verified = true;
          break;
        }

        const data = await res.json();
        if (res.status === 409) {
          // Already processed — treat as success
          verified = true;
          break;
        }
        if (res.status === 202) {
          // Not confirmed yet, wait and retry
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }

        // Other error
        setError(data.error || 'Verification failed');
        setLoading(false);
        setStatus('');
        return;
      }

      if (!verified) {
        setError('Deposit sent but verification timed out. It may take a moment to reflect.');
      }

      setStatus('Done!');
      setTimeout(() => onAdded(), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Transaction failed');
      setStatus('');
    } finally {
      setLoading(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-[4px] p-6"
        style={{ background: 'var(--board-dark)', border: '1px dashed var(--dust-medium)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold" style={{ color: 'var(--chalk-white)', fontFamily: 'var(--font-chalk-header)' }}>
            Deposit CHALK
          </h2>
          <button onClick={onClose} className="transition-colors cursor-pointer" style={{ color: 'var(--chalk-ghost)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {onChainBalance !== null && (
          <div className="mb-5 py-3 rounded-[4px] text-center" style={{ background: 'var(--dust-light)', border: '1px dashed var(--dust-medium)' }}>
            <p className="text-2xl font-bold" style={{ color: 'var(--color-yellow)', fontFamily: 'var(--font-chalk-header)' }}>
              {Math.floor(onChainBalance).toLocaleString()}
              {price !== null && (
                <span className="text-sm ml-1.5 opacity-50" style={{ color: 'var(--chalk-dim)' }}>
                  (~{formatUsd(Math.floor(onChainBalance), price)})
                </span>
              )}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--chalk-ghost)' }}>
              CHALK in wallet ({walletAddress.slice(0, 4)}...{walletAddress.slice(-4)})
            </p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 mb-4">
          {PRESET_AMOUNTS.map((preset) => (
            <button
              key={preset}
              onClick={() => setAmount(String(preset))}
              className="py-2.5 rounded-[4px] text-sm font-bold transition-all duration-200 cursor-pointer"
              style={{
                background: amount === String(preset) ? 'rgba(245,217,96,0.12)' : 'var(--dust-light)',
                border: `1px dashed ${amount === String(preset) ? 'rgba(245,217,96,0.3)' : 'var(--dust-medium)'}`,
                color: amount === String(preset) ? 'var(--color-yellow)' : 'var(--chalk-ghost)',
              }}
            >
              {preset.toLocaleString()}
              {price !== null && (
                <span className="block text-[9px] opacity-50" style={{ color: 'var(--chalk-dim)' }}>
                  ~{formatUsd(preset, price)}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="mb-5">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Custom amount"
            min={1}
            className="w-full px-3 py-2.5 rounded-[4px] text-sm outline-none"
            style={{
              background: 'var(--dust-light)',
              border: '1px dashed var(--dust-medium)',
              color: 'var(--chalk-white)',
            }}
          />
        </div>

        {error && <p className="text-xs mb-3" style={{ color: 'var(--color-red)' }}>{error}</p>}
        {status && !error && <p className="text-xs mb-3" style={{ color: 'var(--color-yellow)' }}>{status}</p>}

        <button
          onClick={handleDeposit}
          disabled={loading || !amount}
          className="w-full py-3 rounded-[4px] text-sm font-bold transition-all duration-200 disabled:opacity-50 cursor-pointer"
          style={{
            background: 'rgba(245,217,96,0.15)',
            border: '1px dashed rgba(245,217,96,0.3)',
            color: 'var(--color-yellow)',
          }}
        >
          {loading ? status || 'Processing...' : `Deposit ${amount ? parseInt(amount).toLocaleString() : '0'} CHALK${price !== null && amount ? ` (~${formatUsd(parseInt(amount) || 0, price)})` : ''}`}
        </button>
      </div>
    </div>,
    document.body
  );
}
