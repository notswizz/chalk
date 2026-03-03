import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';

let app: App;

if (getApps().length === 0) {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (clientEmail && privateKey) {
    app = initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
  } else {
    // Fallback: use application default credentials or project ID only
    app = initializeApp({
      projectId,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
  }
} else {
  app = getApps()[0];
}

export const adminStorage = getStorage(app);

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
