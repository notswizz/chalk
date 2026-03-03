import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { firestore } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export const runtime = 'nodejs';

const STAT_LABELS: Record<string, string> = { points: 'PTS', rebounds: 'REB', assists: 'AST', threes: '3PM' };

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let player = 'Unknown';
  let direction = 'over';
  let target = 0;
  let stat = 'points';
  let userName = 'Anonymous';
  let gameTitle = '';

  try {
    const snap = await getDoc(doc(firestore, 'chalk-cards', id));
    if (snap.exists()) {
      const data = snap.data();
      player = data.player || player;
      direction = data.direction || direction;
      target = data.target || target;
      stat = data.stat || stat;
      userName = data.userName || userName;
      gameTitle = data.gameTitle || '';
    }
  } catch {
    // use defaults
  }

  const statLabel = STAT_LABELS[stat] || stat;
  const dirColor = direction === 'over' ? '#5de88a' : '#e85d5d';

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1a2a1a 0%, #0f1a0f 50%, #1a2a1a 100%)',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* Border */}
        <div
          style={{
            position: 'absolute',
            inset: '16px',
            border: '2px dashed rgba(107,104,96,0.4)',
            borderRadius: '8px',
            display: 'flex',
          }}
        />

        {/* Game title */}
        {gameTitle && (
          <div style={{ color: '#6b6860', fontSize: '24px', marginBottom: '16px', display: 'flex' }}>
            {gameTitle}
          </div>
        )}

        {/* Player name */}
        <div style={{ color: '#e8e4d9', fontSize: '72px', fontWeight: 'bold', marginBottom: '16px', display: 'flex' }}>
          {player}
        </div>

        {/* Direction + target + stat */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
          <div
            style={{
              background: dirColor + '25',
              border: `2px dashed ${dirColor}50`,
              borderRadius: '6px',
              padding: '8px 20px',
              color: dirColor,
              fontSize: '32px',
              fontWeight: 'bold',
              display: 'flex',
            }}
          >
            {direction.toUpperCase()}
          </div>
          <div style={{ color: '#e8e4d9', fontSize: '64px', fontWeight: 'bold', display: 'flex' }}>
            {target}
          </div>
          <div style={{ color: '#6b6860', fontSize: '32px', display: 'flex' }}>
            {statLabel}
          </div>
        </div>

        {/* By line */}
        <div style={{ color: '#6b6860', fontSize: '22px', display: 'flex' }}>
          by {userName}
        </div>

        {/* Chalk branding */}
        <div
          style={{
            position: 'absolute',
            bottom: '32px',
            color: '#f5d960',
            fontSize: '36px',
            fontWeight: 'bold',
            display: 'flex',
            opacity: 0.7,
          }}
        >
          CHALK
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
