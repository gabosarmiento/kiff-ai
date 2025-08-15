/** @type {import('next').NextConfig} */
const BACKEND_ORIGIN = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'

const nextConfig = {
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

export default nextConfig;
