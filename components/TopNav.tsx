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
            <NavLink href="/clips" label="Clips" active={pathname === '/clips' || pathname.startsWith('/clip/')} />
            <NavLink href="/buy" label="Buy CHALK" active={pathname === '/buy'} />
          </nav>
        </div>

        {/* Right: profile badge */}
        <LoginButton />
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
