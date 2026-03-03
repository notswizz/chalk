import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'a.espn.com',
      },
      {
        protocol: 'https',
        hostname: '*.espncdn.com',
      },
    ],
  },
};

export default nextConfig;
