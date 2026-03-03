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
  let result = '';

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
      result = data.result || '';
    }
  } catch {
    // use defaults
  }

  const statLabel = STAT_LABELS[stat] || stat;
  const dirColor = direction === 'over' ? '#5de88a' : '#e85d5d';

  let stampText = '';
  let stampColor = '';
  if (result === 'creator_wins' || result === 'taker_wins') {
    stampText = 'CASHED';
    stampColor = '#5de88a';
  } else if (result === 'push') {
    stampText = 'PUSH';
    stampColor = '#a8a494';
  } else if (result) {
    stampText = 'ERASED';
    stampColor = '#e85d5d';
  }

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
          background: 'linear-gradient(160deg, #1a2a1a 0%, #0f1a0f 40%, #1a2a1a 100%)',
          fontFamily: 'sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Spotlight glow */}
        <div
          style={{
            position: 'absolute',
            top: '-100px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '800px',
            height: '500px',
            background: 'radial-gradient(ellipse, rgba(36,53,36,0.6) 0%, transparent 70%)',
            display: 'flex',
          }}
        />

        {/* Dashed border */}
        <div
          style={{
            position: 'absolute',
            inset: '16px',
            border: '2px dashed rgba(107,104,96,0.35)',
            borderRadius: '12px',
            display: 'flex',
          }}
        />

        {/* Game title */}
        {gameTitle && (
          <div style={{ color: '#6b6860', fontSize: '22px', letterSpacing: '3px', marginBottom: '12px', textTransform: 'uppercase', display: 'flex' }}>
            {gameTitle}
          </div>
        )}

        {/* Player name */}
        <div
          style={{
            color: '#e8e4d9',
            fontSize: '78px',
            fontWeight: 'bold',
            marginBottom: '20px',
            display: 'flex',
            textShadow: '0 0 40px rgba(232,228,217,0.15)',
          }}
        >
          {player.toUpperCase()}
        </div>

        {/* Direction + target + stat */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '28px' }}>
          <div
            style={{
              background: dirColor + '20',
              border: `2px dashed ${dirColor}45`,
              borderRadius: '8px',
              padding: '10px 28px',
              color: dirColor,
              fontSize: '30px',
              fontWeight: 'bold',
              letterSpacing: '2px',
              display: 'flex',
            }}
          >
            {direction.toUpperCase()}
          </div>
          <div
            style={{
              color: '#e8e4d9',
              fontSize: '72px',
              fontWeight: 'bold',
              display: 'flex',
              textShadow: `0 0 30px ${dirColor}30`,
            }}
          >
            {target}
          </div>
          <div style={{ color: '#6b6860', fontSize: '30px', display: 'flex' }}>
            {statLabel}
          </div>
        </div>

        {/* Result stamp */}
        {stampText && (
          <div
            style={{
              display: 'flex',
              padding: '12px 40px',
              borderRadius: '8px',
              border: `3px dashed ${stampColor}50`,
              background: `${stampColor}15`,
              marginBottom: '20px',
            }}
          >
            <span
              style={{
                color: stampColor,
                fontSize: '40px',
                fontWeight: 'bold',
                letterSpacing: '4px',
                textShadow: `0 0 30px ${stampColor}40`,
              }}
            >
              {stampText}
            </span>
          </div>
        )}

        {/* By line */}
        <div style={{ color: '#6b6860', fontSize: '22px', display: 'flex' }}>
          by {userName}
        </div>

        {/* CHALK branding */}
        <div
          style={{
            position: 'absolute',
            bottom: '28px',
            color: '#f5d960',
            fontSize: '38px',
            fontWeight: 'bold',
            letterSpacing: '6px',
            display: 'flex',
            opacity: 0.7,
            textShadow: '0 0 20px rgba(245,217,96,0.3)',
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
