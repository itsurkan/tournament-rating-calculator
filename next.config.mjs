/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/tournament-rating-calculator',
  trailingSlash: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
