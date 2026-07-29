import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

/**
 * Routing guard only.
 *
 * This runs before the app and simply redirects anonymous visitors to the login
 * screen and signed-in ones away from it. It deliberately does NOT decide
 * authorization: it trusts the JWT without a database round-trip, so a
 * deactivated user could still pass here. Real enforcement lives in
 * `requireUser` / `requireAdmin`, which re-read the user on every request.
 */
const PUBLIC_PATHS = ['/prijava'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie: process.env.NODE_ENV === 'production',
  });

  const isPublic = PUBLIC_PATHS.some((path) => pathname.startsWith(path));

  if (!token && !isPublic) {
    const url = new URL('/prijava', request.url);
    // Preserve where they were heading so login can send them back.
    if (pathname !== '/') url.searchParams.set('nastavi', pathname);
    return NextResponse.redirect(url);
  }

  if (token && isPublic) {
    return NextResponse.redirect(new URL('/pocetna', request.url));
  }

  // Password changes are mandatory after an admin reset - let the user reach
  // only that page until it is done.
  if (token?.mustChangePassword && !pathname.startsWith('/lozinka')) {
    return NextResponse.redirect(new URL('/lozinka', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Pages only. Every /api route authenticates itself - the live endpoints via
     * `requireUser`, the cron endpoint via a shared secret - and they must answer
     * with JSON. If middleware handled them, an expired session would return the
     * login page's HTML to a fetch() call expecting JSON.
     */
    '/((?!api|_next/static|_next/image|favicon.ico|hero.jpg|.*\\.svg$).*)',
  ],
};
