'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useCallback } from 'react';

/** Chalk dust particles that fly out on interaction */
export function ChalkPuff({ trigger, children }: { trigger: boolean; children: React.ReactNode }) {
  return (
    <div className="relative inline-flex">
      {children}
      <AnimatePresence>
        {trigger && (
          <>
            {[...Array(6)].map((_, i) => {
              const angle = (i * 60) + Math.random() * 30;
              const rad = (angle * Math.PI) / 180;
              const dist = 16 + Math.random() * 12;
              return (
                <motion.span
                  key={i}
                  className="absolute top-1/2 left-1/2 w-1 h-1 rounded-full pointer-events-none"
                  style={{ background: 'var(--chalk-dim)' }}
                  initial={{ x: 0, y: 0, opacity: 0.8, scale: 1 }}
                  animate={{
                    x: Math.cos(rad) * dist,
                    y: Math.sin(rad) * dist,
                    opacity: 0,
                    scale: 0.3,
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                />
              );
            })}
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Blur-in + fade for text appearing (chalk being written) */
export function ChalkWrite({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, filter: 'blur(4px)', x: -4 }}
      animate={{ opacity: 1, filter: 'blur(0px)', x: 0 }}
      transition={{ duration: 0.4, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

/** Blur-out + fade for content removal (chalk being erased) */
export function ChalkErase({ children, visible }: { children: React.ReactNode; visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, filter: 'blur(6px)', x: 4 }}
          transition={{ duration: 0.3, ease: 'easeIn' }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Hook to trigger chalk puff on click */
export function useChalkPuff() {
  const [puffing, setPuffing] = useState(false);
  const triggerPuff = useCallback(() => {
    setPuffing(true);
    setTimeout(() => setPuffing(false), 400);
  }, []);
  return { puffing, triggerPuff };
}
