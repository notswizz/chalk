import { NextRequest, NextResponse } from 'next/server';
import { firestore } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let videoUrl = '';
  try {
    const snap = await getDoc(doc(firestore, 'chalk-cards', id));
    if (snap.exists()) {
      videoUrl = snap.data().url || '';
    }
  } catch {
    // fall through
  }

  const html = videoUrl
    ? `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0;padding:0}body{background:#000;overflow:hidden}video{width:100%;height:100vh;object-fit:contain}</style></head>
<body><video src="${videoUrl}" autoplay loop playsinline muted></video></body></html>`
    : `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>body{background:#000;color:#666;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh}</style></head>
<body><p>Video not found</p></body></html>`;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html',
      'X-Frame-Options': 'ALLOWALL',
      'Content-Security-Policy': 'frame-ancestors *',
    },
  });
}
