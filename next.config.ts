import type { NextConfig } from 'next';

/**
 * Static security headers.
 *
 * The Content-Security-Policy is deliberately NOT here: it needs a per-response
 * nonce, and headers declared in this file are the same for every request. It
 * is set in `src/middleware.ts` instead, which covers every page route. The
 * paths the middleware matcher skips are `/api` (JSON, where a CSP does
 * nothing) and `/_next/*` (build output, never navigated to directly).
 */
const isProd = process.env.NODE_ENV === 'production';

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
