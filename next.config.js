/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Fix: 'eslint' key is not supported in next.config.js for recent versions
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'dummyimage.com',
      },
    ],
  },
  // API Routes are automatic in App Router
  // Optimization for Hosting (Standalone Build)
  output: 'standalone',
};

module.exports = nextConfig;
