import { Metadata } from 'next';
import { firestore } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;

  try {
    const snap = await getDoc(doc(firestore, 'clips', id));
    if (snap.exists()) {
      const data = snap.data();
      const title = `${data.gameTitle || 'Game'} Clip`;
      const description = `${data.userName || 'User'} clipped a moment from ${data.gameTitle || 'a live game'} on Chalk.`;
      return {
        title,
        description,
        openGraph: {
          title: `${title} | Chalk`,
          description,
          type: 'video.other',
          videos: data.url ? [{ url: data.url }] : [],
        },
        twitter: {
          card: 'summary_large_image',
          title: `${title} | Chalk`,
          description,
        },
      };
    }
  } catch {
    // fall through
  }

  return { title: 'Clip | Chalk' };
}

export default function ClipLayout({ children }: { children: React.ReactNode }) {
  return children;
}
