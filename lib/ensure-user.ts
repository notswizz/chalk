import { firestore } from '@/lib/firebase';
import { doc, getDocFromServer, setDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';

const REFERRAL_BONUS = 500;

export async function ensureUserDoc(userId: string, referredByUsername?: string) {
  const userRef = doc(firestore, 'users', userId);
  const snap = await getDocFromServer(userRef);
  if (snap.exists()) return { ...snap.data(), isNew: false };

  const newUser: Record<string, unknown> = {
    displayName: '',
    email: '',
    avatarUrl: '',
    walletAddress: '',
    coins: 500,
    usernameSet: false,
    totalBetsCreated: 0,
    totalBetsTaken: 0,
    createdAt: Date.now(),
  };

  // Process referral if provided
  if (referredByUsername) {
    const referrerQuery = query(
      collection(firestore, 'users'),
      where('displayName', '==', referredByUsername)
    );
    const referrerSnap = await getDocs(referrerQuery);

    if (!referrerSnap.empty) {
      const referrerDoc = referrerSnap.docs[0];
      const referrerData = referrerDoc.data();

      // Credit referrer
      await updateDoc(doc(firestore, 'users', referrerDoc.id), {
        coins: (referrerData.coins ?? 0) + REFERRAL_BONUS,
      });

      // Record referral on new user and give bonus
      newUser.coins = 500 + REFERRAL_BONUS;
      newUser.referredBy = referrerDoc.id;
      newUser.referredByUsername = referredByUsername;

      // Track referral count on referrer
      await updateDoc(doc(firestore, 'users', referrerDoc.id), {
        referralCount: (referrerData.referralCount ?? 0) + 1,
      });
    }
  }

  await setDoc(userRef, newUser);
  return { ...newUser, isNew: true };
}
