'use client';

export function LiveBadge({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  const isSm = size === 'sm';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[4px] font-bold uppercase tracking-wider ${
        isSm
          ? 'px-2 py-0.5 text-[10px]'
          : 'px-2.5 py-1 text-xs'
      }`}
      style={{
        background: 'rgba(245,217,96,0.2)',
        color: 'var(--color-yellow)',
        boxShadow: '0 0 12px rgba(245, 217, 96, 0.15)',
        fontFamily: 'var(--font-chalk-header)',
      }}
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: 'var(--color-yellow)' }} />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: 'var(--color-yellow)' }} />
      </span>
      LIVE
    </span>
  );
}
