export const dynamic = 'force-dynamic';

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <h1
          className="text-4xl font-bold mb-2"
          style={{ color: 'var(--color-yellow)', fontFamily: 'var(--font-chalk-header)' }}
        >
          404
        </h1>
        <p className="text-sm" style={{ color: 'var(--chalk-ghost)' }}>
          Page not found
        </p>
      </div>
    </div>
  );
}
