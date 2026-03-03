'use client';

const STORAGE_KEY = 'streamhub-favorites';

export interface FavoriteTeam {
  abbreviation: string;
  displayName: string;
  sport: string;
}

export function getFavorites(): FavoriteTeam[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addFavorite(team: FavoriteTeam): void {
  const favs = getFavorites();
  if (!favs.some((f) => f.abbreviation === team.abbreviation && f.sport === team.sport)) {
    favs.push(team);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favs));
  }
}

export function removeFavorite(abbreviation: string, sport: string): void {
  const favs = getFavorites().filter(
    (f) => !(f.abbreviation === abbreviation && f.sport === sport)
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(favs));
}

export function isFavorite(abbreviation: string, sport: string): boolean {
  return getFavorites().some((f) => f.abbreviation === abbreviation && f.sport === sport);
}
