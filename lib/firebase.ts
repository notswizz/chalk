import { initializeApp, getApps } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getFirestore } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, User } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function init() {
  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    return {
      db: getDatabase(app),
      firestore: getFirestore(app),
      auth: getAuth(app),
      storage: getStorage(app),
    };
  } catch {
    // Build time — env vars missing, return null placeholders
    return {
      db: null as ReturnType<typeof getDatabase> | null,
      firestore: null as ReturnType<typeof getFirestore> | null,
      auth: null as ReturnType<typeof getAuth> | null,
      storage: null as ReturnType<typeof getStorage> | null,
    };
  }
}

const { db: _db, firestore: _firestore, auth: _auth, storage: _storage } = init();

// Re-export with non-null assertions — at runtime these are always valid
export const db = _db!;
export const firestore = _firestore!;
export const auth = _auth!;
export const storage = _storage!;

export async function ensureAuth(): Promise<User> {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      if (user) {
        resolve(user);
      } else {
        signInAnonymously(auth).then((cred) => resolve(cred.user)).catch(reject);
      }
    });
  });
}
