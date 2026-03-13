import { NextResponse } from 'next/server';
import { verifyAuth, getPrivyUserEmail } from '@/lib/auth';
import { firestore } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { ensureUserDoc } from '@/lib/ensure-user';

export async function GET(req: Request) {
  try {
    const userId = await verifyAuth(req);
    const { searchParams } = new URL(req.url);
    const ref = searchParams.get('ref') || undefined;
    const data = await ensureUserDoc(userId, ref);

    // Persist email from Privy if not already saved
    if (!(data as Record<string, unknown>).email) {
      const email = await getPrivyUserEmail(userId);
      if (email) {
        await updateDoc(doc(firestore, 'users', userId), { email });
      }
    }

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unauthorized';
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

export async function PATCH(req: Request) {
  try {
    const userId = await verifyAuth(req);
    await ensureUserDoc(userId);
    const body = await req.json();
    const updates: Record<string, string | boolean> = {};

    if (body.displayName) {
      updates.displayName = body.displayName;
      updates.usernameSet = true;
    }
    if (body.avatarUrl) updates.avatarUrl = body.avatarUrl;
    if (body.walletAddress) updates.walletAddress = body.walletAddress;

    if (Object.keys(updates).length > 0) {
      await updateDoc(doc(firestore, 'users', userId), updates);
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unauthorized';
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
