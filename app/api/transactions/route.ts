import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { firestore } from '@/lib/firebase';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';

export async function GET(req: Request) {
  try {
    const userId = await verifyAuth(req);

    const txQuery = query(
      collection(firestore, 'transactions'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const snapshot = await getDocs(txQuery);
    const transactions = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ transactions });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unauthorized';
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
