'use client';

import { SPORTS, Sport } from '@/lib/types';

interface SportTabsProps {
  active: Sport | 'all';
  onChange: (sport: Sport | 'all') => void;
}

export function SportTabs({ active, onChange }: SportTabsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      <button
        onClick={() => onChange('all')}
        className={`flex-shrink-0 px-4 py-2 rounded-[4px] text-sm font-medium transition-colors ${
          active === 'all'
            ? 'text-[var(--board-dark)]'
            : 'hover:text-[var(--chalk-dim)]'
        }`}
        style={{
          background: active === 'all' ? 'var(--color-yellow)' : 'var(--board-medium)',
          color: active === 'all' ? 'var(--board-dark)' : 'var(--chalk-dim)',
        }}
      >
        All Sports
      </button>
      {SPORTS.map((sport) => (
        <button
          key={sport.key}
          onClick={() => onChange(sport.key)}
          className={`flex-shrink-0 px-4 py-2 rounded-[4px] text-sm font-medium transition-colors whitespace-nowrap`}
          style={{
            background: active === sport.key ? 'var(--color-yellow)' : 'var(--board-medium)',
            color: active === sport.key ? 'var(--board-dark)' : 'var(--chalk-dim)',
          }}
        >
          {sport.emoji} {sport.label}
        </button>
      ))}
    </div>
  );
}
