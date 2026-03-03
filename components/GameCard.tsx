'use client';

import Link from 'next/link';
import { Game } from '@/lib/types';
import { GameOdds } from '@/lib/kalshi';
import { ScoreDisplay } from './ScoreDisplay';

export interface GameVolume {
  wagered: number;
  pending: number;
  total: number;
}

interface GameCardProps {
  game: Game;
  odds?: GameOdds;
  volume?: GameVolume;
}

function formatChalk(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return n.toString();
}

export function GameCard({ game, odds, volume }: GameCardProps) {
  const isLive = game.state === 'in';
  const isFinal = game.state === 'post';
  const hasOdds = odds && odds.away !== null && odds.home !== null;

  return (
    <Link href={`/game/${game.id}`} className="block">
      <div
        className={`chalk-card card-glow rounded-[4px] p-4 cursor-pointer ${
          isLive ? 'live-card' : ''
        } ${isFinal ? 'opacity-60 hover:opacity-100' : ''}`}
      >
        <ScoreDisplay game={game} />

        {/* Odds bar — hand-drawn style */}
        {hasOdds && !isFinal && (
          <div className="mt-3 pt-3 chalk-stroke-top">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <span
                  className="text-sm tabular-nums chalk-header"
                  style={{ color: odds.away! > odds.home! ? 'var(--color-green)' : 'var(--chalk-ghost)' }}
                >
                  {odds.away}%
                </span>
                <span className="text-xs" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>{game.awayTeam.abbreviation}</span>
              </div>
              {odds.spread && (
                <span className="text-xs tabular-nums chalk-header" style={{ color: 'var(--color-blue)' }}>
                  {odds.spread.team} -{odds.spread.line}
                </span>
              )}
              <div className="flex items-center gap-1.5">
                <span className="text-xs" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>{game.homeTeam.abbreviation}</span>
                <span
                  className="text-sm tabular-nums chalk-header"
                  style={{ color: odds.home! > odds.away! ? 'var(--color-green)' : 'var(--chalk-ghost)' }}
                >
                  {odds.home}%
                </span>
              </div>
            </div>
            {/* Hand-drawn probability bar */}
            <div className="prob-bar-container">
              <div className="prob-bar-bg" />
              <div
                className="prob-bar-fill prob-bar-fill-away"
                style={{
                  width: `${odds.away}%`,
                  background: odds.away! > odds.home!
                    ? 'linear-gradient(90deg, var(--color-green), rgba(138, 245, 171, 0.7))'
                    : 'rgba(232, 228, 217, 0.12)',
                }}
              />
              <div
                className="prob-bar-fill prob-bar-fill-home"
                style={{
                  width: `${odds.home}%`,
                  background: odds.home! > odds.away!
                    ? 'linear-gradient(90deg, rgba(138, 245, 171, 0.7), var(--color-green))'
                    : 'rgba(232, 228, 217, 0.12)',
                }}
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <div className={`${hasOdds && !isFinal ? 'mt-3' : 'mt-3 pt-3 chalk-stroke-top'} flex items-center justify-between`}>
          <div className="flex items-center gap-2">
            {game.broadcast && (
              <span
                className="px-2 py-0.5 rounded-[4px] text-xs tracking-wider"
                style={{
                  background: 'rgba(232, 228, 217, 0.05)',
                  border: '1px dashed rgba(232, 228, 217, 0.1)',
                  color: 'var(--chalk-ghost)',
                  fontFamily: 'var(--font-chalk-body)',
                }}
              >
                {game.broadcast}
              </span>
            )}
            {volume && volume.total > 0 && (
              <span
                className="flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-xs tabular-nums"
                style={{
                  background: 'rgba(245,217,96,0.06)',
                  border: '1px dashed rgba(245,217,96,0.12)',
                  color: 'var(--color-yellow)',
                  fontFamily: 'var(--font-chalk-body)',
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" opacity="0.7">
                  <circle cx="12" cy="12" r="10" />
                </svg>
                {formatChalk(volume.total)}
              </span>
            )}
          </div>

          {!isFinal && (
            <span
              className="chalk-btn chalk-btn-accent flex items-center gap-1.5 px-3.5 py-1.5 rounded-[4px] text-sm cursor-pointer"
              style={{ fontFamily: 'var(--font-chalk-header)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Watch
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
