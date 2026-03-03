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
  async headers() {
    return [
      {
        source: '/api/card-embed/:id',
        headers: [
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
          { key: 'Content-Security-Policy', value: 'frame-ancestors *' },
        ],
      },
    ];
  },
};

export default nextConfig;
