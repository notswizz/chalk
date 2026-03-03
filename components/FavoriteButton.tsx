'use client';

import { useState, useEffect } from 'react';
import { isFavorite, addFavorite, removeFavorite, FavoriteTeam } from '@/lib/favorites';

interface FavoriteButtonProps {
  team: FavoriteTeam;
}

export function FavoriteButton({ team }: FavoriteButtonProps) {
  const [fav, setFav] = useState(false);
  const [pop, setPop] = useState(false);

  useEffect(() => {
    setFav(isFavorite(team.abbreviation, team.sport));
  }, [team.abbreviation, team.sport]);

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (fav) {
      removeFavorite(team.abbreviation, team.sport);
    } else {
      addFavorite(team);
      setPop(true);
      setTimeout(() => setPop(false), 300);
    }
    setFav(!fav);
  };

  return (
    <button
      onClick={toggle}
      className={`transition-all duration-200 ${pop ? 'scale-125' : 'scale-100 hover:scale-110'}`}
      title={fav ? 'Remove from favorites' : 'Add to favorites'}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill={fav ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={fav ? 0 : 1.8}
        className={`transition-colors duration-200 ${
          fav ? 'drop-shadow-[0_0_6px_rgba(245,217,96,0.4)]' : ''
        }`}
        style={{ color: fav ? 'var(--color-yellow)' : 'var(--chalk-ghost)' }}
      >
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    </button>
  );
}
