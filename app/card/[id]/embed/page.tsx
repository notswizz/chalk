import { firestore } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

async function getCardUrl(id: string): Promise<string | null> {
  try {
    const snap = await getDoc(doc(firestore, 'chalk-cards', id));
    if (!snap.exists()) return null;
    return snap.data().url || null;
  } catch {
    return null;
  }
}

export default async function EmbedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = await getCardUrl(id);

  if (!url) {
    return (
      <html>
        <body style={{ margin: 0, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
          <p style={{ color: '#666', fontFamily: 'sans-serif' }}>Video not found</p>
        </body>
      </html>
    );
  }

  return (
    <html>
      <body style={{ margin: 0, background: '#000', overflow: 'hidden' }}>
        <video
          src={url}
          autoPlay
          loop
          playsInline
          muted
          style={{ width: '100%', height: '100vh', objectFit: 'contain' }}
        />
      </body>
    </html>
  );
}
