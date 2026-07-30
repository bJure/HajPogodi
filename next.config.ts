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

  /*
   * Navigation speed.
   *
   * Partial Prerendering (`cacheComponents`) is deliberately NOT enabled, even
   * though it is the obvious tool for this: it cannot coexist with the
   * nonce-based CSP in `src/middleware.ts`. Next reads the nonce off the
   * request headers at render time, so a shell prerendered at build time gets
   * no nonce at all - the prerendered `/` in `.next/server/app/index.html` has
   * fifteen script tags and not one `nonce` attribute. Because the policy uses
   * 'strict-dynamic', which makes 'self' be ignored for scripts, those tags are
   * blocked outright rather than merely unverified, and the page renders blank.
   * Serving a prerendered shell would mean dropping the nonce for
   * 'unsafe-inline', which is the trade this app already refused.
   *
   * So the same goal is reached from the client instead:
   *  - `dynamicOnHover` lets a link upgrade to a full prefetch - data included,
   *    not just the loading skeleton - the moment the pointer lands on it. The
   *    request is already in flight by the time the click happens. Nothing is
   *    fetched until that intent, so the four nav links do not each cost a
   *    render on every page view the way `prefetch` in the viewport would.
   *  - `staleTimes.dynamic` lets the router reuse a page it already has when the
   *    user navigates back to it, which is most of the clicking in a four-page
   *    app. Thirty seconds is safe here because every write goes through a
   *    server action that calls `revalidatePath`, which drops this cache, and
   *    the live components re-poll on their own schedule anyway.
   *
   * Note that hover prefetching is inert under `next dev` - Next skips it when
   * NODE_ENV is development, so this only shows up in a production build.
   */
  experimental: {
    dynamicOnHover: true,
    staleTimes: { dynamic: 30 },
  },
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
