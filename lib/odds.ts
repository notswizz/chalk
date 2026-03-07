/**
 * Tournament prop odds utilities.
 * Pure P2P — no vig. Opposite odds are a simple sign flip.
 */

export function calculateOppositeOdds(americanOdds: number): number {
  if (americanOdds > 0) return -americanOdds;
  return Math.abs(americanOdds);
}

export function calculatePayout(stake: number, americanOdds: number): number {
  if (americanOdds > 0) {
    return Math.round(stake * (americanOdds / 100));
  }
  return Math.round(stake * (100 / Math.abs(americanOdds)));
}

export function calculateTakerStake(creatorStake: number, creatorOdds: number): number {
  // Taker's stake = creator's potential payout
  return calculatePayout(creatorStake, creatorOdds);
}

export function isValidAmericanOdds(odds: number): boolean {
  return odds !== 0 && (odds >= 100 || odds <= -100);
}

export function formatAmericanOdds(odds: number): string {
  return odds > 0 ? `+${odds}` : `${odds}`;
}
