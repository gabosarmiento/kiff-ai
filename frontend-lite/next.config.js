/* eslint-env node */
/* eslint-disable */
// @ts-nocheck

const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN || 'http://localhost:8000'

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@kiff/ui'],
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${BACKEND_ORIGIN}/api/:path*`,
      },
    ]
  },
}

module.exports = nextConfig;
