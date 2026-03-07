'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { SPORTS, Sport, SportConfig } from '@/lib/types';

const SPORT_KEY = 'chalk_sport';
const SPORT_EVENT = 'chalk_sport_change';

function readSport(): Sport {
  if (typeof window === 'undefined') return 'nba';
  // URL param takes priority
  const params = new URLSearchParams(window.location.search);
  const param = params.get('sport');
  const urlMatch = SPORTS.find((s) => s.key === param && s.enabled);
  if (urlMatch) return urlMatch.key;
  // Then localStorage
  const stored = localStorage.getItem(SPORT_KEY);
  const storedMatch = SPORTS.find((s) => s.key === stored && s.enabled);
  if (storedMatch) return storedMatch.key;
  return 'nba';
}

let _listeners: (() => void)[] = [];
let _snapshot: Sport = 'nba';

function subscribe(cb: () => void) {
  _listeners.push(cb);
  return () => { _listeners = _listeners.filter((l) => l !== cb); };
}

function getSnapshot(): Sport {
  return _snapshot;
}

function getServerSnapshot(): Sport {
  return 'nba';
}

function notifyAll() {
  _snapshot = readSport();
  _listeners.forEach((cb) => cb());
}

// Init + listen for the custom event
if (typeof window !== 'undefined') {
  _snapshot = readSport();
  window.addEventListener(SPORT_EVENT, notifyAll);
  window.addEventListener('popstate', notifyAll);
}

/** Set the active sport globally. All useSport() consumers re-render. */
export function setSport(sport: Sport) {
  localStorage.setItem(SPORT_KEY, sport);
  window.history.pushState({}, '', `/?sport=${sport}`);
  window.dispatchEvent(new Event(SPORT_EVENT));
}

/** Shared hook — all callers see the same sport, always in sync. */
export function useSport(): Sport {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function SportSelector() {
  const sport = useSport();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const current = SPORTS.find((s) => s.key === sport) ?? SPORTS[0];

  function select(s: SportConfig) {
    if (!s.enabled) return;
    setOpen(false);
    setSport(s.key);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] text-[11px] uppercase tracking-[0.15em] transition-all duration-200 cursor-pointer"
        style={{
          fontFamily: 'var(--font-chalk-header)',
          color: 'var(--chalk-white)',
          background: open ? 'rgba(245,217,96,0.08)' : 'transparent',
          border: `1px dashed ${open ? 'rgba(245,217,96,0.2)' : 'transparent'}`,
        }}
      >
        <span>{current.emoji}</span>
        <span>{current.label}</span>
        <svg
          width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          style={{ color: 'var(--chalk-ghost)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-1 rounded-[4px] overflow-hidden z-50 min-w-[140px]"
          style={{
            background: 'var(--board-dark)',
            border: '1px dashed var(--dust-medium)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          }}
        >
          {SPORTS.map((s) => (
            <button
              key={s.key}
              onClick={() => select(s)}
              disabled={!s.enabled}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                fontFamily: 'var(--font-chalk-body)',
                color: s.key === sport ? 'var(--color-yellow)' : s.enabled ? 'var(--chalk-white)' : 'var(--chalk-ghost)',
                background: s.key === sport ? 'rgba(245,217,96,0.06)' : 'transparent',
              }}
              onMouseEnter={(e) => { if (s.enabled) (e.currentTarget as HTMLElement).style.background = 'var(--dust-light)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = s.key === sport ? 'rgba(245,217,96,0.06)' : 'transparent'; }}
            >
              <span>{s.emoji}</span>
              <span>{s.label}</span>
              {!s.enabled && (
                <span className="ml-auto text-[9px] tracking-wider uppercase" style={{ color: 'var(--chalk-ghost)' }}>Soon</span>
              )}
              {s.key === sport && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="ml-auto" style={{ color: 'var(--color-yellow)' }}>
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
