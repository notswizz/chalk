import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { getDatabase } from 'firebase-admin/database';
import { getFirestore } from 'firebase-admin/firestore';

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

function init() {
  try {
    const app = getApp();
    return {
      adminStorage: getStorage(app),
      adminDb: getDatabase(app),
      adminFirestore: getFirestore(app),
    };
  } catch {
    return {
      adminStorage: null as ReturnType<typeof getStorage> | null,
      adminDb: null as ReturnType<typeof getDatabase> | null,
      adminFirestore: null as ReturnType<typeof getFirestore> | null,
    };
  }
}

const { adminStorage: _storage, adminDb: _db, adminFirestore: _firestore } = init();

export const adminStorage = _storage!;
export const adminDb = _db!;
export const adminFirestore = _firestore!;

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
