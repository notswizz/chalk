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
  CHALK_MINT_ADDRESS,
  CHALK_DECIMALS,
  getOwnerWalletAddress,
  coinsToRaw,
} from '@/lib/solana';

export function AddTokensModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const { getAccessToken, wallet, walletMismatch, savedWalletAddress, profile } = useUser();
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
      // Derive the user's ATA address directly — avoids expensive getTokenAccountsByOwner
      const [userAta] = await findAssociatedTokenPda({
        owner: address(walletAddress),
        tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
        mint: CHALK_MINT_ADDRESS,
      });

      const res = await fetch('/api/solana-rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getTokenAccountBalance',
          params: [userAta.toString()],
        }),
      });
      const data = await res.json();
      if (data.error) {
        // Account doesn't exist = 0 balance
        setOnChainBalance(0);
        return;
      }
      setOnChainBalance(Number(data.result?.value?.uiAmount ?? 0));
    } catch (e) {
      console.error('[Deposit] Balance fetch failed:', e);
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
        owner: getOwnerWalletAddress(),
        tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
        mint: CHALK_MINT_ADDRESS,
      });

      // Create owner ATA if needed (idempotent) — user pays
      const createAtaIx = getCreateAssociatedTokenIdempotentInstruction({
        payer: noopSigner,
        ata: ownerAta,
        owner: getOwnerWalletAddress(),
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

      const sigRaw = result.signature;

      // Privy may return signature as base58 string or Uint8Array
      let sigString: string;
      if (typeof sigRaw === 'string') {
        sigString = sigRaw;
      } else {
        const { getBase58Decoder } = await import('@solana/kit');
        sigString = getBase58Decoder().decode(sigRaw);
      }

      // Verify deposit on backend
      setStatus('Verifying...');
      const token = await getAccessToken();

      let verified = false;
      for (let i = 0; i < 20; i++) {
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
        setStatus('');
        setLoading(false);
        return;
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

        {/* Wallet mismatch warning */}
        {walletMismatch && savedWalletAddress && (
          <div
            className="mb-4 rounded-[4px] px-4 py-3"
            style={{ background: 'rgba(232,93,93,0.08)', border: '1px dashed rgba(232,93,93,0.25)' }}
          >
            <p className="text-xs font-semibold mb-1" style={{ color: 'var(--color-red)' }}>
              Wrong wallet connected
            </p>
            <p className="text-[11px]" style={{ color: 'var(--chalk-ghost)' }}>
              Switch to {savedWalletAddress.slice(0, 4)}...{savedWalletAddress.slice(-4)} in Phantom to deposit.
            </p>
          </div>
        )}

        {/* Balance cards */}
        {!walletMismatch && (
          <div className="grid grid-cols-2 gap-2.5 mb-5">
            {/* In-game balance */}
            <div
              className="rounded-[4px] px-3 py-3"
              style={{ background: 'rgba(232,228,217,0.04)', border: '1.5px dashed rgba(232,228,217,0.1)' }}
            >
              <span className="text-[9px] uppercase tracking-[0.15em] chalk-header block mb-1" style={{ color: 'var(--chalk-ghost)' }}>
                In-Game
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl tabular-nums chalk-score" style={{ color: 'var(--chalk-white)' }}>
                  {(profile?.coins ?? 0).toLocaleString()}
                </span>
              </div>
              {price !== null && (
                <div className="text-[10px] tabular-nums mt-0.5" style={{ color: 'var(--chalk-dim)', fontFamily: 'var(--font-chalk-body)' }}>
                  {formatUsd(profile?.coins ?? 0, price)}
                </div>
              )}
            </div>

            {/* Wallet balance */}
            {onChainBalance !== null && (
              <div
                className="rounded-[4px] px-3 py-3"
                style={{ background: 'rgba(245,217,96,0.04)', border: '1.5px dashed rgba(245,217,96,0.15)' }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] uppercase tracking-[0.15em] chalk-header" style={{ color: 'var(--chalk-ghost)' }}>
                    Wallet
                  </span>
                  <span className="text-[9px]" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
                    {walletAddress.slice(0, 4)}...{walletAddress.slice(-4)}
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl tabular-nums chalk-score" style={{ color: 'var(--color-yellow)' }}>
                    {Math.floor(onChainBalance).toLocaleString()}
                  </span>
                </div>
                {price !== null && (
                  <div className="text-[10px] tabular-nums mt-0.5" style={{ color: 'var(--chalk-dim)', fontFamily: 'var(--font-chalk-body)' }}>
                    {formatUsd(Math.floor(onChainBalance), price)}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Amount selection */}
        <div className="mb-3">
          <span className="text-[10px] uppercase tracking-[0.15em] chalk-header block mb-2" style={{ color: 'var(--chalk-ghost)' }}>
            Amount
          </span>
          <div className="grid grid-cols-2 gap-2">
            {([
              { label: 'Half', value: Math.floor((onChainBalance ?? 0) / 2) },
              { label: 'Max', value: Math.floor(onChainBalance ?? 0) },
            ]).map(({ label, value }) => {
              const selected = amount === String(value) && value > 0;
              return (
                <button
                  key={label}
                  onClick={() => { if (value > 0) setAmount(String(value)); }}
                  disabled={value <= 0}
                  className="py-3 rounded-[4px] transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: selected ? 'rgba(245,217,96,0.12)' : 'var(--dust-light)',
                    border: `1.5px dashed ${selected ? 'rgba(245,217,96,0.35)' : 'rgba(232,228,217,0.1)'}`,
                    color: selected ? 'var(--color-yellow)' : 'var(--chalk-dim)',
                  }}
                >
                  <span className="text-[10px] uppercase tracking-[0.12em] chalk-header block mb-0.5" style={{ color: 'var(--chalk-ghost)' }}>
                    {label}
                  </span>
                  <span className="text-base tabular-nums chalk-score block">{value.toLocaleString()}</span>
                  {price !== null && value > 0 && (
                    <span className="text-[10px] tabular-nums block mt-0.5" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
                      {formatUsd(value, price)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom input */}
        <div className="mb-5">
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Custom amount"
              min={1}
              className="w-full pl-3 pr-20 py-3 rounded-[4px] text-sm outline-none tabular-nums"
              style={{
                background: 'var(--dust-light)',
                border: '1.5px dashed rgba(232,228,217,0.1)',
                color: 'var(--chalk-white)',
                fontFamily: 'var(--font-chalk-body)',
              }}
            />
            {price !== null && amount && parseInt(amount) > 0 && (
              <span
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs tabular-nums"
                style={{ color: 'var(--chalk-dim)', fontFamily: 'var(--font-chalk-body)' }}
              >
                {formatUsd(parseInt(amount) || 0, price)}
              </span>
            )}
          </div>
        </div>

        {/* Status / Error */}
        {error && (
          <div className="mb-3 px-3 py-2 rounded-[4px]" style={{ background: 'rgba(232,93,93,0.08)', border: '1px dashed rgba(232,93,93,0.2)' }}>
            <p className="text-xs" style={{ color: 'var(--color-red)', fontFamily: 'var(--font-chalk-body)' }}>{error}</p>
          </div>
        )}
        {status && !error && (
          <div className="mb-3 px-3 py-2 rounded-[4px]" style={{ background: 'rgba(245,217,96,0.06)', border: '1px dashed rgba(245,217,96,0.15)' }}>
            <p className="text-xs flex items-center gap-2" style={{ color: 'var(--color-yellow)', fontFamily: 'var(--font-chalk-body)' }}>
              {loading && <span className="inline-block w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />}
              {status}
            </p>
          </div>
        )}

        {/* Deposit button */}
        <button
          onClick={handleDeposit}
          disabled={loading || !amount || walletMismatch}
          className="w-full py-3.5 rounded-[4px] text-sm chalk-header tracking-wide transition-all duration-200 disabled:opacity-50 cursor-pointer"
          style={{
            background: 'rgba(245,217,96,0.12)',
            border: '1.5px dashed rgba(245,217,96,0.35)',
            color: 'var(--color-yellow)',
            boxShadow: loading ? 'none' : '0 0 20px rgba(245,217,96,0.06)',
          }}
        >
          {loading ? (status || 'Processing...') : (
            <>
              Deposit {amount ? parseInt(amount).toLocaleString() : '0'} CHALK
              {price !== null && amount && parseInt(amount) > 0 && (
                <span className="ml-1.5" style={{ color: 'var(--chalk-dim)' }}>
                  ({formatUsd(parseInt(amount) || 0, price)})
                </span>
              )}
            </>
          )}
        </button>
      </div>
    </div>,
    document.body
  );
}
