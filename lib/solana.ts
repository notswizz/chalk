import { address, createSolanaRpc } from '@solana/kit';

export const CHALK_MINT = '4khj2EMrS97s6LyWdSiga2yne74TfpbodFjd69mXpump';
export const CHALK_DECIMALS = 6;
// CHALK is a Token-2022 (Token Extensions) token
export const CHALK_TOKEN_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
export const SOLANA_RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

export function getOwnerWallet() {
  return process.env.NEXT_PUBLIC_OWNER_WALLET!;
}

export const CHALK_MINT_ADDRESS = address(CHALK_MINT);

let _ownerAddress: ReturnType<typeof address> | null = null;
export function getOwnerWalletAddress() {
  if (!_ownerAddress) _ownerAddress = address(getOwnerWallet());
  return _ownerAddress;
}

/** Convert raw token amount (with decimals) to human-readable coin count */
export function rawToCoins(raw: bigint): number {
  return Number(raw) / 10 ** CHALK_DECIMALS;
}

/** Convert human-readable coin count to raw token amount */
export function coinsToRaw(coins: number): bigint {
  return BigInt(Math.round(coins * 10 ** CHALK_DECIMALS));
}

/** Get a Solana RPC client */
export function getRpc() {
  return createSolanaRpc(SOLANA_RPC_URL);
}
