import { Metadata } from 'next';
import { firestore } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import CardClient from './CardClient';

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
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'https://chalkstreams.vercel.app';
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
  const playerUrl = `${baseUrl}/api/card-embed/${id}`;

  const dimensions = card.format === 'story'
    ? { width: 720, height: 1280 }
    : card.format === 'square'
    ? { width: 1080, height: 1080 }
    : { width: 1280, height: 720 };

  return {
    title: `${title} | Chalk`,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      url: `${baseUrl}/card/${id}`,
      videos: [
        {
          url: card.url,
          width: dimensions.width,
          height: dimensions.height,
          type: 'video/webm',
        },
      ],
    },
    twitter: {
      card: 'player',
      title,
      description,
      players: [
        {
          playerUrl,
          streamUrl: card.url,
          width: dimensions.width,
          height: dimensions.height,
        },
      ],
    },
  };
}

export default async function ChalkCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CardClient id={id} />;
}
