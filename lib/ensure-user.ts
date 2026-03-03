import { firestore } from '@/lib/firebase';
import { doc, getDocFromServer, setDoc } from 'firebase/firestore';

export async function ensureUserDoc(userId: string) {
  const userRef = doc(firestore, 'users', userId);
  const snap = await getDocFromServer(userRef);
  if (snap.exists()) return snap.data();

  const newUser = {
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
  await setDoc(userRef, newUser);
  return newUser;
}
