'use client';

import { Game } from '@/lib/types';
import { TeamLogo } from './TeamLogo';
import { LiveBadge } from './LiveBadge';

interface ScoreDisplayProps {
  game: Game;
  large?: boolean;
}

export function ScoreDisplay({ game, large = false }: ScoreDisplayProps) {
  const logoSize = large ? 56 : 36;

  return (
    <div className="flex items-center gap-3">
      {/* Away team */}
      <div className="flex items-center gap-3 flex-1 justify-end min-w-0">
        <div className="text-right min-w-0">
          <div
            className={`truncate ${large ? 'text-lg' : 'text-sm'}`}
            style={{ color: 'var(--chalk-white)', fontFamily: 'var(--font-chalk-body)' }}
          >
            {large ? game.awayTeam.displayName : game.awayTeam.abbreviation}
          </div>
          {large && (
            <div className="text-xs" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>{game.awayTeam.abbreviation}</div>
          )}
        </div>
        <TeamLogo logo={game.awayTeam.logo} name={game.awayTeam.displayName} size={logoSize} glow={large} />
      </div>

      {/* Center: Score or Time */}
      <div className="flex-shrink-0 text-center" style={{ minWidth: large ? 130 : 100 }}>
        {game.state === 'pre' ? (
          <div className="space-y-0.5">
            <div
              className={`${large ? 'text-xl' : 'text-base'} chalk-header`}
              style={{ color: 'var(--chalk-dim)' }}
            >
              {new Date(game.date).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
              })}
            </div>
            <div className="text-xs" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>
              Today
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            {game.state === 'in' && (
              <div className="flex justify-center mb-1">
                <LiveBadge size={large ? 'lg' : 'sm'} />
              </div>
            )}
            <div
              className={`chalk-score tabular-nums tracking-tight ${
                large ? 'text-4xl' : 'text-2xl'
              } ${game.state === 'in' ? 'chalk-text-glow' : ''}`}
              style={{
                color: game.state === 'post' ? 'var(--chalk-dim)' : 'var(--chalk-white)',
              }}
            >
              {game.awayTeam.score}
              <span className="mx-2" style={{ color: 'var(--chalk-ghost)', opacity: 0.6 }}>-</span>
              {game.homeTeam.score}
            </div>
            {game.state === 'in' && (
              <div className="text-xs" style={{ color: 'var(--chalk-dim)', fontFamily: 'var(--font-chalk-body)' }}>{game.shortDetail}</div>
            )}
            {game.state === 'post' && (
              <div className="chalk-header text-xs tracking-widest" style={{ color: 'var(--chalk-ghost)' }}>FINAL</div>
            )}
          </div>
        )}
      </div>

      {/* Home team */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <TeamLogo logo={game.homeTeam.logo} name={game.homeTeam.displayName} size={logoSize} glow={large} />
        <div className="min-w-0">
          <div
            className={`truncate ${large ? 'text-lg' : 'text-sm'}`}
            style={{ color: 'var(--chalk-white)', fontFamily: 'var(--font-chalk-body)' }}
          >
            {large ? game.homeTeam.displayName : game.homeTeam.abbreviation}
          </div>
          {large && (
            <div className="text-xs" style={{ color: 'var(--chalk-ghost)', fontFamily: 'var(--font-chalk-body)' }}>{game.homeTeam.abbreviation}</div>
          )}
        </div>
      </div>
    </div>
  );
}
