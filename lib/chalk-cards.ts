import { storage, firestore, ensureAuth } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, doc, setDoc } from 'firebase/firestore';

export interface ChalkCardMetadata {
  id: string;
  userId: string;
  userName: string;
  betId: string;
  player: string;
  stat: string;
  target: number;
  direction: string;
  result?: string;
  gameTitle?: string;
  format: string;
  duration: number;
  url: string;
  createdAt: number;
}

export async function uploadChalkCard(blob: Blob, cardId: string): Promise<string> {
  await ensureAuth();

  const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
  const storageRef = ref(storage, `chalk-cards/${cardId}.${ext}`);
  await uploadBytes(storageRef, blob, { contentType: blob.type });
  return getDownloadURL(storageRef);
}

export async function saveChalkCardMetadata(data: ChalkCardMetadata): Promise<void> {
  const docRef = doc(collection(firestore, 'chalk-cards'), data.id);
  await setDoc(docRef, data);
}
