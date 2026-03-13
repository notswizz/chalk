'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LoginButton } from '@/components/auth/LoginButton';

const NAV_ITEMS = [
  {
    href: '/games',
    label: 'Games',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    href: '/favorites',
    label: 'Favorites',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    ),
  },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 safe-bottom">
      <div style={{ background: 'var(--board-dark)', borderTop: '1px dashed var(--dust-light)' }}>
        <div className="max-w-lg mx-auto flex items-center">
          <Link
            href="/"
            className="flex-1 flex flex-col items-center gap-1 py-3 transition-all duration-200"
            style={{ color: pathname === '/' ? 'var(--color-yellow)' : 'var(--chalk-ghost)' }}
          >
            <span className="text-sm font-bold tracking-wide" style={{ fontFamily: 'var(--font-chalk-header)' }}>
              CHALK
            </span>
            {pathname === '/' && (
              <span className="w-1 h-1 rounded-full" style={{ background: 'var(--color-yellow)' }} />
            )}
          </Link>
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex-1 flex flex-col items-center gap-1 py-3 transition-all duration-200"
                style={{ color: active ? 'var(--color-yellow)' : 'var(--chalk-ghost)' }}
              >
                <span className="relative">
                  {item.icon(active)}
                  {active && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full" style={{ background: 'var(--color-yellow)' }} />
                  )}
                </span>
                <span className="text-[10px] font-semibold tracking-wide">{item.label}</span>
              </Link>
            );
          })}
          <div className="flex-1 flex justify-center py-2">
            <LoginButton />
          </div>
        </div>
      </div>
    </nav>
  );
}
