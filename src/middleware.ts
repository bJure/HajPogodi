import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

/**
 * Routing guard and Content-Security-Policy.
 *
 * The routing half simply redirects anonymous visitors to the login screen and
 * signed-in ones away from it. It deliberately does NOT decide authorization:
 * it trusts the JWT without a database round-trip, so a deactivated user could
 * still pass here. Real enforcement lives in `requireUser` / `requireAdmin`,
 * which re-read the user on every request.
 *
 * The CSP lives here rather than in `next.config.ts` because a useful policy
 * needs a fresh nonce per response, and `headers()` in the config is static. A
 * static policy could only allow Next's inline bootstrap with 'unsafe-inline',
 * which lets any injected <script> run too - that is, no protection at all.
 */
const PUBLIC_PATHS = ['/prijava'];

const isProd = process.env.NODE_ENV === 'production';

/**
 * Notes on the individual directives:
 *  - 'strict-dynamic' lets the nonced bootstrap load Next's own chunks without
 *    listing every hashed filename; with it present, 'self' is ignored for
 *    scripts by design.
 *  - 'unsafe-eval' is needed by the dev-mode React refresh runtime only.
 *  - style-src keeps 'unsafe-inline': Tailwind's runtime layer and Recharts both
 *    emit inline style attributes, and there is no nonce path for those. Inline
 *    styles are a far smaller lever than inline scripts.
 */
function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isProd ? '' : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    // Club crests are hotlinked from whichever provider supplied the fixture:
    // HNS for domestic matches, ESPN for European ones. Without both hosts
    // listed the policy silently blocks every logo on the page.
    "img-src 'self' data: blob: https://hns.family https://a.espncdn.com https://media.api-sports.io",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce);

  // Next reads the nonce off the *request* headers and stamps it onto the
  // script tags it renders itself.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie: isProd,
  });

  const isPublic = PUBLIC_PATHS.some((path) => pathname.startsWith(path));

  const redirectTo = (path: string, search?: string): NextResponse => {
    const url = new URL(path, request.url);
    if (search) url.searchParams.set('nastavi', search);
    return withCsp(NextResponse.redirect(url), csp);
  };

  if (!token && !isPublic) {
    // Preserve where they were heading so login can send them back.
    return redirectTo('/prijava', pathname !== '/' ? pathname : undefined);
  }

  if (token && isPublic) {
    return redirectTo('/pocetna');
  }

  // Password changes are mandatory after an admin reset - let the user reach
  // only that page until it is done.
  if (token?.mustChangePassword && !pathname.startsWith('/lozinka')) {
    return redirectTo('/lozinka');
  }

  return withCsp(NextResponse.next({ request: { headers: requestHeaders } }), csp);
}

function withCsp(response: NextResponse, csp: string): NextResponse {
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    /*
     * Pages only. Every /api route authenticates itself - the live endpoints via
     * `requireUser`, the cron endpoint via a shared secret - and they must answer
     * with JSON. If middleware handled them, an expired session would return the
     * login page's HTML to a fetch() call expecting JSON.
     *
     * Static assets are excluded here too, so their CSP comes from the static
     * header set in `next.config.ts`.
     */
    '/((?!api|_next/static|_next/image|favicon.ico|hero.jpg|.*\\.svg$).*)',
  ],
};
