import { storage, firestore, ensureAuth } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, doc, setDoc } from 'firebase/firestore';

export interface ClipMetadata {
  id: string;
  userId: string;
  userName: string;
  gameId: string;
  gameTitle: string;
  sport: string;
  duration: number;
  url: string;
  createdAt: number;
}

export async function uploadClip(blob: Blob, clipId: string): Promise<string> {
  // Ensure Firebase auth so storage rules allow the upload
  await ensureAuth();

  const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
  const storageRef = ref(storage, `clips/${clipId}.${ext}`);
  await uploadBytes(storageRef, blob, { contentType: blob.type });
  return getDownloadURL(storageRef);
}

export async function saveClipMetadata(data: ClipMetadata): Promise<void> {
  const docRef = doc(collection(firestore, 'clips'), data.id);
  await setDoc(docRef, data);
}
