'use client';

import { SessionProvider } from 'next-auth/react';

/**
 * Client-side session context. Only needed so the password-change flow can
 * refresh the JWT claim without forcing a re-login; pages themselves read the
 * session on the server.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider refetchOnWindowFocus={false}>{children}</SessionProvider>;
}
