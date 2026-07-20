/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'web-push', 'node-cron'],
    instrumentationHook: true,
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // web-push depends on Node's built-in crypto — keep it out of the webpack bundle
      config.externals = [...(config.externals ?? []), 'web-push', 'node-cron']
    } else {
      config.resolve.fallback = { ...config.resolve.fallback, crypto: false }
    }
    return config
  },
}

export default nextConfig
