/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    domains: ['supabase.co', 'dummyimage.com'],
  },
  // API Routes are automatic in App Router
};

module.exports = nextConfig;
