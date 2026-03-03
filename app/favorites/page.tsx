'use client';

import { useEffect, useState, useCallback } from 'react';
import { Game, SPORTS, Sport } from '@/lib/types';
import { GameCard } from '@/components/GameCard';
import { getFavorites, removeFavorite, FavoriteTeam } from '@/lib/favorites';

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<FavoriteTeam[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshFavorites = useCallback(() => {
    setFavorites(getFavorites());
  }, []);

  useEffect(() => {
    refreshFavorites();
  }, [refreshFavorites]);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/games?sport=all');
        const data = await res.json();
        setGames(data.games ?? []);
      } catch {
        // Keep empty
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const favoriteAbbrs = favorites.map((f) => f.abbreviation);
  const favoriteGames = games.filter(
    (g) =>
      favoriteAbbrs.includes(g.homeTeam.abbreviation) ||
      favoriteAbbrs.includes(g.awayTeam.abbreviation)
  );

  const handleRemove = (fav: FavoriteTeam) => {
    removeFavorite(fav.abbreviation, fav.sport);
    refreshFavorites();
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--chalk-white)', fontFamily: 'var(--font-chalk-header)' }}>My Favorites</h1>

      {/* Favorite teams list */}
      {favorites.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--chalk-ghost)' }}>
            Your Teams
          </h2>
          <div className="flex flex-wrap gap-2">
            {favorites.map((fav) => {
              const sportInfo = SPORTS.find((s) => s.key === fav.sport);
              return (
                <div
                  key={`${fav.sport}-${fav.abbreviation}`}
                  className="flex items-center gap-2 rounded-[4px] px-3 py-1.5"
                  style={{ background: 'var(--board-medium)', border: '1px dashed var(--dust-light)', color: 'var(--chalk-dim)' }}
                >
                  <span className="text-sm">
                    {sportInfo?.emoji ?? ''} {fav.abbreviation}
                  </span>
                  <button
                    onClick={() => handleRemove(fav)}
                    className="text-xs"
                    style={{ color: 'var(--chalk-ghost)' }}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Favorite team games */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--color-yellow)', borderTopColor: 'transparent' }} />
        </div>
      )}

      {!loading && favorites.length === 0 && (
        <div className="text-center py-20" style={{ color: 'var(--chalk-ghost)' }}>
          <p className="text-lg font-medium" style={{ color: 'var(--chalk-dim)' }}>No favorites yet</p>
          <p className="text-sm mt-1">
            Tap the star icon on any game page to add teams to your favorites.
          </p>
        </div>
      )}

      {!loading && favorites.length > 0 && favoriteGames.length === 0 && (
        <div className="text-center py-12" style={{ color: 'var(--chalk-ghost)' }}>
          <p>No games today for your favorite teams.</p>
        </div>
      )}

      {!loading && favoriteGames.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--chalk-ghost)' }}>
            Today&apos;s Games
          </h2>
          <div className="space-y-3">
            {favoriteGames.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
