/* eslint-env node */
/* eslint-disable */
// @ts-nocheck

const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN || 'http://localhost:8000'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['lucide-react', 'react-hot-toast'],
  },
  async rewrites() {
    return [
      // Proxy specific backend API routes
      {
        source: '/backend/:path*',
        destination: `${BACKEND_ORIGIN}/:path*`,
      },
      {
        source: '/api/kb/:path*',
        destination: `${BACKEND_ORIGIN}/api/kb/:path*`,
      },
      {
        source: '/api/users/:path*',
        destination: `${BACKEND_ORIGIN}/api/users/:path*`,
      },
      {
        source: '/api/extract/:path*',
        destination: `${BACKEND_ORIGIN}/api/extract/:path*`,
      },
      {
        source: '/api/kiffs/:path*',
        destination: `${BACKEND_ORIGIN}/api/kiffs/:path*`,
      },
      {
        source: '/api/models/:path*',
        destination: `${BACKEND_ORIGIN}/api/models/:path*`,
      },
      {
        source: '/api/compose/:path*',
        destination: `${BACKEND_ORIGIN}/api/compose/:path*`,
      },
      {
        source: '/api/packs/:path*',
        destination: `${BACKEND_ORIGIN}/api/packs/:path*`,
      },
    ]
  },
}

module.exports = nextConfig;
