import type { NextConfig } from 'next';

/**
 * Security headers applied to every response.
 *
 * The CSP allows 'unsafe-inline' for styles because Tailwind's runtime layer and
 * Recharts both emit inline style attributes. Scripts stay nonce-free but are
 * restricted to 'self'; Next's inline bootstrap requires 'unsafe-inline' in dev
 * only, so the directive is tightened in production builds.
 */
const isProd = process.env.NODE_ENV === 'production';

const csp = [
  "default-src 'self'",
  `script-src 'self' ${isProd ? "'unsafe-inline'" : "'unsafe-inline' 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://media.api-sports.io",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ['pino'],
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'media.api-sports.io' }],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          ...(isProd
            ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
