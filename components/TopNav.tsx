'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LoginButton } from '@/components/auth/LoginButton';

export function TopNav() {
  const pathname = usePathname();

  return (
    <header
      className="sticky top-0 z-50"
      style={{
        background: 'rgba(26, 42, 26, 0.9)',
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* Chalk divider bottom */}
      <div className="absolute bottom-0 left-0 right-0 chalk-divider" />

      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Left: title + nav links */}
        <div className="flex items-center gap-6">
          <Link href="/" className="text-lg chalk-text" style={{ color: 'var(--chalk-white)', fontFamily: 'var(--font-chalk-header)' }}>
            Chalk
          </Link>
          <nav className="flex items-center gap-1">
            <NavLink href="/" label="Games" active={pathname === '/'} />
            <NavLink href="/bets" label="The Board" active={pathname === '/bets'} />
            <NavLink href="/activity" label="Activity" active={pathname === '/activity'} />
            <NavLink href="/leaderboard" label="Leaderboard" active={pathname === '/leaderboard'} />
            <NavLink href="/clips" label="Clips" active={pathname === '/clips' || pathname.startsWith('/clip/')} />
            <NavLink href="/buy" label="Buy CHALK" active={pathname === '/buy'} />
          </nav>
        </div>

        {/* Right: discord + profile badge */}
        <div className="flex items-center gap-3">
          <a
            href="https://x.com/chalk_streams"
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-[4px] transition-all duration-200 hover:scale-105"
            style={{ color: 'var(--chalk-ghost)' }}
            title="Follow on X"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
          <a
            href="https://discord.gg/VN2r3Gxg"
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-[4px] transition-all duration-200 hover:scale-105"
            style={{ color: 'var(--chalk-ghost)' }}
            title="Join our Discord"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
            </svg>
          </a>
          <LoginButton />
        </div>
      </div>
    </header>
  );
}

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className="px-3 py-1.5 rounded-[4px] text-sm transition-all duration-200"
      style={{
        fontFamily: 'var(--font-chalk-body)',
        color: active ? 'var(--color-yellow)' : 'var(--chalk-ghost)',
        background: active ? 'rgba(245,217,96,0.08)' : 'transparent',
        borderBottom: active ? '1px dashed rgba(245,217,96,0.3)' : '1px dashed transparent',
      }}
    >
      {label}
    </Link>
  );
}
