import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { firestore } from '@/lib/firebase';
import { doc, runTransaction } from 'firebase/firestore';
import { ensureUserDoc } from '@/lib/ensure-user';

const REQUIRED_VALIDATIONS = 3;

interface Validation {
  userId: string;
  actualValue: number;
  timestamp: number;
}

export async function POST(req: Request) {
  try {
    const userId = await verifyAuth(req);
    await ensureUserDoc(userId);

    const { betId, actualValue } = await req.json();

    if (!betId || actualValue == null || isNaN(Number(actualValue))) {
      return NextResponse.json({ error: 'Missing betId or actualValue' }, { status: 400 });
    }

    const actual = Number(actualValue);
    const betRef = doc(firestore, 'bets', betId);

    const result = await runTransaction(firestore, async (tx) => {
      const betSnap = await tx.get(betRef);
      if (!betSnap.exists()) throw new Error('Bet not found');

      const bet = betSnap.data();
      if (bet.status !== 'matched') throw new Error('Bet is already settled');
      if (bet.creatorId === userId || bet.takerId === userId) {
        throw new Error('Cannot validate your own bet');
      }

      const validations: Validation[] = bet.validations ?? [];

      // Check if user already validated
      if (validations.some((v: Validation) => v.userId === userId)) {
        throw new Error('You already validated this bet');
      }

      // Add this validation
      const newValidation: Validation = { userId, actualValue: actual, timestamp: Date.now() };
      const updatedValidations = [...validations, newValidation];

      // Check for consensus: do REQUIRED_VALIDATIONS agree on the same value?
      const valueCounts: Record<number, number> = {};
      for (const v of updatedValidations) {
        valueCounts[v.actualValue] = (valueCounts[v.actualValue] ?? 0) + 1;
      }

      const consensusValue = Object.entries(valueCounts).find(
        ([, count]) => count >= REQUIRED_VALIDATIONS
      );

      if (consensusValue) {
        // Settle the bet
        const settledValue = Number(consensusValue[0]);
        const isPush = settledValue === bet.target;
        const actualDirection = settledValue > bet.target ? 'over' : 'under';
        const creatorWins = !isPush && actualDirection === bet.direction;
        const totalPool = bet.creatorStake + bet.takerStake;

        if (isPush) {
          const creatorRef = doc(firestore, 'users', bet.creatorId);
          const takerRef = doc(firestore, 'users', bet.takerId);
          const creatorSnap = await tx.get(creatorRef);
          const takerSnap = await tx.get(takerRef);
          if (creatorSnap.exists()) {
            tx.update(creatorRef, { coins: (creatorSnap.data().coins ?? 0) + bet.creatorStake });
          }
          if (takerSnap.exists()) {
            tx.update(takerRef, { coins: (takerSnap.data().coins ?? 0) + bet.takerStake });
          }
        } else {
          const winnerId = creatorWins ? bet.creatorId : bet.takerId;
          const winnerRef = doc(firestore, 'users', winnerId);
          const winnerSnap = await tx.get(winnerRef);
          if (winnerSnap.exists()) {
            tx.update(winnerRef, { coins: (winnerSnap.data().coins ?? 0) + totalPool });
          }
        }

        tx.update(betRef, {
          status: 'settled',
          validations: updatedValidations,
          actualValue: settledValue,
          actualDirection,
          result: isPush ? 'push' : (creatorWins ? 'creator_wins' : 'taker_wins'),
          settledAt: Date.now(),
        });

        return { settled: true, validationCount: updatedValidations.length, required: REQUIRED_VALIDATIONS };
      } else {
        // Not enough consensus yet, just store the validation
        tx.update(betRef, { validations: updatedValidations });
        return { settled: false, validationCount: updatedValidations.length, required: REQUIRED_VALIDATIONS };
      }
    });

    return NextResponse.json(result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to validate';
    const status = message.includes('Unauthorized') || message.includes('token') ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
