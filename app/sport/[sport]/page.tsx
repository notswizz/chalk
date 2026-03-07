'use client';

import { useEffect, useState, use } from 'react';
import { Game, Sport, SPORTS } from '@/lib/types';
import { GameCard } from '@/components/GameCard';

export const dynamic = 'force-dynamic';

export default function SportPage({ params }: { params: Promise<{ sport: string }> }) {
  const { sport } = use(params);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  const sportInfo = SPORTS.find((s) => s.key === sport);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/games?sport=${sport}`);
        const data = await res.json();
        setGames(data.games ?? []);
      } catch {
        // Keep empty
      } finally {
        setLoading(false);
      }
    }
    load();

    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [sport]);

  const liveGames = games.filter((g) => g.state === 'in');
  const upcomingGames = games.filter((g) => g.state === 'pre');
  const finalGames = games.filter((g) => g.state === 'post');

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--chalk-white)', fontFamily: 'var(--font-chalk-header)' }}>
        {sportInfo ? `${sportInfo.emoji} ${sportInfo.label}` : (sport as Sport).toUpperCase()}
      </h1>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--color-yellow)', borderTopColor: 'transparent' }} />
        </div>
      )}

      {!loading && games.length === 0 && (
        <div className="text-center py-20" style={{ color: 'var(--chalk-ghost)' }}>
          <p className="text-lg font-medium" style={{ color: 'var(--chalk-dim)' }}>No games today</p>
        </div>
      )}

      {!loading && (
        <div className="space-y-6">
          {liveGames.length > 0 && (
            <Section title="Live Now" games={liveGames} />
          )}
          {upcomingGames.length > 0 && (
            <Section title="Upcoming" games={upcomingGames} />
          )}
          {finalGames.length > 0 && (
            <Section title="Final" games={finalGames} />
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, games }: { title: string; games: Game[] }) {
  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--chalk-ghost)' }}>
        {title}
      </h2>
      <div className="space-y-3">
        {games.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}
      </div>
    </section>
  );
}
