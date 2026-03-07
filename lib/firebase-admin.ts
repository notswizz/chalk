import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getStorage, Storage } from 'firebase-admin/storage';
import { getDatabase, Database } from 'firebase-admin/database';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

function getApp(): App {
  if (getApps().length > 0) return getApps()[0];

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const databaseURL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  if (clientEmail && privateKey) {
    return initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      storageBucket,
      databaseURL,
    });
  }

  return initializeApp({ projectId, storageBucket, databaseURL });
}

// Lazy getters — avoid crashing at build time when env vars are missing
let _storage: Storage;
let _db: Database;
let _firestore: Firestore;

export const adminStorage = new Proxy({} as Storage, {
  get(_, prop) {
    if (!_storage) _storage = getStorage(getApp());
    return Reflect.get(_storage, prop);
  },
});

export const adminDb = new Proxy({} as Database, {
  get(_, prop) {
    if (!_db) _db = getDatabase(getApp());
    return Reflect.get(_db, prop);
  },
});

export const adminFirestore = new Proxy({} as Firestore, {
  get(_, prop) {
    if (!_firestore) _firestore = getFirestore(getApp());
    return Reflect.get(_firestore, prop);
  },
});

export async function uploadBufferToStorage(
  path: string,
  buffer: Buffer | Uint8Array,
  contentType: string
): Promise<string> {
  const bucket = adminStorage.bucket();
  const file = bucket.file(path);

  await file.save(Buffer.from(buffer), {
    metadata: { contentType },
    public: true,
  });

  return `https://storage.googleapis.com/${bucket.name}/${path}`;
}
