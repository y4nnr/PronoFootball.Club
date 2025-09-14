/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
  },
  images: {
    domains: ['i.pravatar.cc', 'placehold.co'],
  },
  i18n: {
    defaultLocale: 'fr',
    locales: ['en', 'fr'],
  },
}

export default nextConfig
