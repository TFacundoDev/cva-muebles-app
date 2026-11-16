import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // El paquete compartido se compila aparte (packages/shared/dist).
  transpilePackages: ['@cva/shared'],
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
