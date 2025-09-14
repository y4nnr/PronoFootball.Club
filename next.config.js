const { i18n } = require('./next-i18next.config');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // disabled to reduce hydration warnings
  i18n,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.pravatar.cc',
      },
      {
        protocol: 'https',
        hostname: 'scontent.fpoz5-1.fna.fbcdn.net',
      },
      {
        protocol: 'https',
        hostname: 'images2.minutemediacdn.com',
      },
      {
        protocol: 'https',
        hostname: 'logos-world.net',
      },
      {
        protocol: 'https',
        hostname: 'logoeps.com',
      },
      {
        protocol: 'https',
        hostname: 'upload.wikimedia.org',
      },
      {
        protocol: 'https',
        hostname: 'cdn.freebiesupply.com',
      },
      {
        protocol: 'https',
        hostname: 'seeklogo.com',
      },
      {
        protocol: 'https',
        hostname: 'seekvectorlogo.com',
      },
      {
        protocol: 'https',
        hostname: 'logosandtypes.com',
      },
      {
        protocol: 'https',
        hostname: 'img.clerk.com',
      },
    ],
  },
  experimental: {
    forceSwcTransforms: true,
  },
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config, { isServer }) => {
    // Add ARM64 support for lightningcss
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;

