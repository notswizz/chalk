'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import React from 'react';

interface ChalkPriceState {
  price: number | null;
  loading: boolean;
}

const ChalkPriceContext = createContext<ChalkPriceState>({ price: null, loading: true });

export function ChalkPriceProvider({ children }: { children: React.ReactNode }) {
  const [price, setPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPrice = useCallback(async () => {
    try {
      const res = await fetch('/api/chalk-price');
      const data = await res.json();
      if (typeof data.price === 'number') {
        setPrice(data.price);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrice();
    const interval = setInterval(fetchPrice, 30_000);
    return () => clearInterval(interval);
  }, [fetchPrice]);

  return React.createElement(
    ChalkPriceContext.Provider,
    { value: { price, loading } },
    children,
  );
}

export function useChalkPrice() {
  return useContext(ChalkPriceContext);
}

export function formatUsd(chalk: number, price: number): string {
  const usd = chalk * price;
  if (usd < 0.01) return '<$0.01';
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}
