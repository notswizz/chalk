import { Metadata } from 'next';
import { firestore } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import CardClient from './CardClient';

export const dynamic = 'force-dynamic';

const STAT_LABELS: Record<string, string> = { points: 'PTS', rebounds: 'REB', assists: 'AST', threes: '3PM' };

interface ChalkCard {
  id: string;
  userName: string;
  player: string;
  stat: string;
  target: number;
  direction: string;
  gameTitle?: string;
  format: string;
  url: string;
}

async function getCard(id: string): Promise<ChalkCard | null> {
  try {
    const snap = await getDoc(doc(firestore, 'chalk-cards', id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as ChalkCard;
  } catch {
    return null;
  }
}

function getBaseUrl(): string {
  return 'https://chalkstreams.live';
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const card = await getCard(id);

  if (!card) {
    return { title: 'Chalk Card' };
  }

  const statLabel = STAT_LABELS[card.stat] || card.stat;
  const title = `${card.player} ${card.direction.toUpperCase()} ${card.target} ${statLabel}`;
  const description = `${card.userName} has ${card.player} ${card.direction} ${card.target} ${statLabel} on the board. ${card.gameTitle || ''}`.trim();
  const baseUrl = getBaseUrl();
  const ogImage = `${baseUrl}/api/og-card/${id}`;

  return {
    title: `${title} | Chalk`,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      url: `${baseUrl}/card/${id}`,
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function ChalkCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CardClient id={id} />;
}
