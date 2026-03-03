'use client';

import Image from 'next/image';
import { useState } from 'react';

interface TeamLogoProps {
  logo: string;
  name: string;
  size?: number;
  glow?: boolean;
}

export function TeamLogo({ logo, name, size = 40, glow = false }: TeamLogoProps) {
  const [error, setError] = useState(false);

  if (error || !logo) {
    return (
      <div
        className="rounded-full flex items-center justify-center font-bold text-xs"
        style={{
          width: size,
          height: size,
          background: 'var(--dust-medium)',
          color: 'var(--chalk-dim)',
        }}
      >
        {name.slice(0, 3).toUpperCase()}
      </div>
    );
  }

  return (
    <div
      className="relative flex-shrink-0"
      style={{ width: size, height: size }}
    >
      {glow && (
        <div
          className="absolute inset-0 rounded-full blur-md opacity-30"
          style={{
            backgroundImage: `url(${logo})`,
            backgroundSize: 'cover',
          }}
        />
      )}
      <Image
        src={logo}
        alt={name}
        width={size}
        height={size}
        className="object-contain relative z-10 drop-shadow-lg"
        onError={() => setError(true)}
        unoptimized
      />
    </div>
  );
}
