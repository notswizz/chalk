'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { createPortal } from 'react-dom';

// ─── Types ───

export type ToastType = 'achievement' | 'milestone' | 'streak' | 'daily' | 'info';

export interface Toast {
  id: string;
  title: string;
  subtitle?: string;
  reward?: number;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (toast: Toast) => void;
}

// ─── Context ───

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

// ─── Theme per type ───

const THEME: Record<ToastType, { bg: string; border: string; glow: string; icon: React.ReactNode }> = {
  achievement: {
    bg: 'rgba(60, 50, 30, 0.95)',
    border: 'rgba(245,217,96,0.4)',
    glow: 'rgba(245,217,96,0.3)',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L14.9 8.6L22 9.3L16.5 14L18 21L12 17.5L6 21L7.5 14L2 9.3L9.1 8.6L12 2Z" fill="var(--color-yellow)" stroke="rgba(245,217,96,0.6)" strokeWidth="0.5" />
      </svg>
    ),
  },
  milestone: {
    bg: 'rgba(30, 55, 45, 0.95)',
    border: 'rgba(93,232,138,0.4)',
    glow: 'rgba(93,232,138,0.3)',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M9 12l2 2 4-4" stroke="var(--color-green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="9" stroke="var(--color-green)" strokeWidth="1.5" />
      </svg>
    ),
  },
  streak: {
    bg: 'rgba(60, 40, 30, 0.95)',
    border: 'rgba(245,150,60,0.4)',
    glow: 'rgba(245,150,60,0.3)',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M12 2C12 2 16 7 16 11C16 13.2 14.2 15 12 15C9.8 15 8 13.2 8 11C8 7 12 2 12 2Z" fill="var(--color-orange)" />
        <path d="M12 11C12 11 14 13 14 15C14 16.1 13.1 17 12 17C10.9 17 10 16.1 10 15C10 13 12 11 12 11Z" fill="var(--color-yellow)" />
        <path d="M10 17C10 19 10.5 22 12 22C13.5 22 14 19 14 17" stroke="var(--color-orange)" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
      </svg>
    ),
  },
  daily: {
    bg: 'rgba(30, 55, 45, 0.95)',
    border: 'rgba(93,232,138,0.35)',
    glow: 'rgba(93,232,138,0.25)',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="4" width="18" height="18" rx="3" stroke="var(--color-green)" strokeWidth="1.5" />
        <path d="M3 9h18" stroke="var(--color-green)" strokeWidth="1.5" />
        <path d="M9 13l2 2 4-4" stroke="var(--color-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 2v3M16 2v3" stroke="var(--color-green)" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  info: {
    bg: 'rgba(35, 50, 55, 0.95)',
    border: 'rgba(93,184,232,0.35)',
    glow: 'rgba(93,184,232,0.2)',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="var(--color-blue)" strokeWidth="1.5" />
        <path d="M12 11v5M12 8v.5" stroke="var(--color-blue)" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
};

// ─── Keyframes (injected once) ───

const STYLE_ID = 'toast-keyframes-v2';

function injectKeyframes() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes toast-shimmer {
      0% { background-position: -200% center; }
      100% { background-position: 200% center; }
    }
    @keyframes toast-pop {
      0% { transform: scale(0.8) translateY(10px); opacity: 0; }
      50% { transform: scale(1.03) translateY(-2px); opacity: 1; }
      100% { transform: scale(1) translateY(0); opacity: 1; }
    }
    @keyframes toast-pts-pop {
      0% { opacity: 0; transform: scale(0.5) translateY(8px); }
      60% { opacity: 1; transform: scale(1.2) translateY(-3px); }
      100% { opacity: 1; transform: scale(1) translateY(0); }
    }
    @keyframes toast-icon-spin {
      0% { transform: rotate(0deg) scale(1); }
      25% { transform: rotate(-15deg) scale(1.2); }
      50% { transform: rotate(10deg) scale(1.15); }
      75% { transform: rotate(-5deg) scale(1.05); }
      100% { transform: rotate(0deg) scale(1); }
    }
    @keyframes toast-border-glow {
      0%, 100% { opacity: 0.6; }
      50% { opacity: 1; }
    }
  `;
  document.head.appendChild(style);
}

// ─── Single toast component ───

const DISMISS_MS = 5000;

interface ToastItemProps {
  toast: Toast;
  index: number;
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, index, onDismiss }: ToastItemProps) {
  const [phase, setPhase] = useState<'enter' | 'visible' | 'exit'>('enter');
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const theme = THEME[toast.type];

  useEffect(() => {
    const raf = requestAnimationFrame(() => setPhase('visible'));
    timerRef.current = setTimeout(() => setPhase('exit'), DISMISS_MS);
    return () => {
      cancelAnimationFrame(raf);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (phase === 'exit') {
      const t = setTimeout(() => onDismiss(toast.id), 350);
      return () => clearTimeout(t);
    }
  }, [phase, toast.id, onDismiss]);

  const handleClick = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPhase('exit');
  };

  const isVisible = phase === 'visible';
  const isExit = phase === 'exit';

  return (
    <div
      style={{
        position: 'absolute',
        right: 0,
        bottom: index * 82,
        width: 340,
        maxWidth: 'calc(100vw - 32px)',
        cursor: 'pointer',
        transform: isVisible
          ? 'translateX(0) scale(1)'
          : isExit
            ? 'translateX(120%) scale(0.9)'
            : 'translateX(120%) scale(0.9)',
        opacity: isVisible ? 1 : 0,
        transition: 'transform 0.35s cubic-bezier(0.23,1,0.32,1), opacity 0.3s ease',
      }}
      onClick={handleClick}
    >
      {/* Outer glow border */}
      <div
        style={{
          position: 'absolute',
          inset: -1,
          borderRadius: 10,
          background: `linear-gradient(135deg, ${theme.border}, transparent, ${theme.border})`,
          opacity: isVisible ? 1 : 0,
          animation: isVisible ? 'toast-border-glow 2s ease-in-out infinite' : undefined,
          transition: 'opacity 0.3s',
        }}
      />

      {/* Card */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 16px',
          borderRadius: 9,
          background: theme.bg,
          backdropFilter: 'blur(12px)',
          boxShadow: `0 0 20px ${theme.glow}, 0 8px 32px rgba(0,0,0,0.5)`,
          animation: isVisible ? 'toast-pop 0.4s cubic-bezier(0.23,1,0.32,1)' : undefined,
        }}
      >
        {/* Icon */}
        <div
          style={{
            flexShrink: 0,
            width: 36,
            height: 36,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `${theme.border}22`,
            animation: isVisible ? 'toast-icon-spin 0.6s ease-out' : undefined,
          }}
        >
          {theme.icon}
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontFamily: 'var(--font-chalk-header)',
              color: 'var(--chalk-white)',
              fontSize: '0.85rem',
              fontWeight: 700,
              lineHeight: 1.3,
              margin: 0,
              letterSpacing: '0.02em',
            }}
          >
            {toast.title}
          </p>
          {toast.subtitle && (
            <p
              style={{
                fontFamily: 'var(--font-chalk-body)',
                color: 'var(--chalk-ghost)',
                fontSize: '0.75rem',
                lineHeight: 1.3,
                margin: '3px 0 0',
              }}
            >
              {toast.subtitle}
            </p>
          )}
        </div>

        {/* Reward badge */}
        {toast.reward != null && (
          <div
            style={{
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1,
              animation: isVisible ? 'toast-pts-pop 0.5s ease-out 0.2s both' : undefined,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-chalk-header)',
                fontSize: '1.15rem',
                fontWeight: 800,
                lineHeight: 1,
                background: 'linear-gradient(135deg, var(--color-yellow), #f5a623)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
                filter: 'drop-shadow(0 0 6px rgba(245,217,96,0.4))',
              }}
            >
              +{toast.reward}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-chalk-body)',
                fontSize: '0.6rem',
                fontWeight: 700,
                color: 'var(--chalk-ghost)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              pts
            </span>
          </div>
        )}

        {/* Progress shimmer bar at bottom */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 8,
            right: 8,
            height: 2,
            borderRadius: 1,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: '100%',
              background: `linear-gradient(90deg, transparent, ${theme.border}, transparent)`,
              backgroundSize: '200% 100%',
              animation: isVisible ? 'toast-shimmer 2s linear infinite' : undefined,
              opacity: 0.6,
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Provider ───

const MAX_VISIBLE = 4;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    injectKeyframes();
  }, []);

  const showToast = useCallback((toast: Toast) => {
    setToasts((prev) => [...prev, toast]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const visible = toasts.slice(-MAX_VISIBLE);

  const portalContent = (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      <div style={{ position: 'relative', pointerEvents: 'auto' }}>
        {visible.map((t, i) => (
          <ToastItem key={t.id} toast={t} index={i} onDismiss={dismiss} />
        ))}
      </div>
    </div>
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {mounted && createPortal(portalContent, document.body)}
    </ToastContext.Provider>
  );
}
