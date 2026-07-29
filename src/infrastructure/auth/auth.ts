import NextAuth, { type NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { headers } from 'next/headers';
import { loginSchema } from '@/application/dto/user';
import { getEnv } from '@/lib/env';
import { logger } from '@/infrastructure/logging/logger';
import { userRepository } from '@/infrastructure/repositories/userRepository';
import { dummyVerify, passwordHasher } from './password';
import { checkLoginRateLimit, recordLoginAttempt } from './rateLimit';

/**
 * Credentials-only authentication. There is no self-registration anywhere in
 * the app - an admin creates every account - so no other provider is wired up.
 *
 * The JWT carries role and nickname for cheap rendering, but it is never the
 * authority on whether an account is still allowed in: `requireUser` re-reads
 * the user on every protected request, so deactivating someone takes effect
 * immediately instead of whenever their token happens to expire.
 */

/** Best-effort client IP, used only for rate limiting. */
async function clientIp(): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? 'unknown';
  return headerList.get('x-real-ip') ?? 'unknown';
}

export const authConfig: NextAuthConfig = {
  secret: getEnv().AUTH_SECRET,
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: '/prijava', error: '/prijava' },
  trustHost: true,

  providers: [
    Credentials({
      credentials: {
        username: { label: 'Korisničko ime', type: 'text' },
        password: { label: 'Lozinka', type: 'password' },
      },

      async authorize(raw) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;

        const { username, password } = parsed.data;
        const ip = await clientIp();

        const limit = await checkLoginRateLimit(username, ip);
        if (limit.blocked) {
          logger.warn({ username, reason: limit.reason }, 'prijava blokirana zbog ogranicenja');
          // A distinct error code so the UI can explain the lockout.
          throw new Error('RATE_LIMITED');
        }

        const user = await userRepository.findByUsername(username);

        if (!user) {
          // Spend comparable CPU time so response timing does not reveal
          // which usernames exist.
          await dummyVerify();
          await recordLoginAttempt(username, ip, false);
          return null;
        }

        const valid = await passwordHasher.verify(password, user.passwordHash);
        if (!valid) {
          await recordLoginAttempt(username, ip, false);
          return null;
        }

        if (!user.isActive) {
          await recordLoginAttempt(username, ip, false);
          logger.info({ userId: user.id }, 'prijava deaktiviranog korisnika odbijena');
          throw new Error('INACTIVE');
        }

        await recordLoginAttempt(username, ip, true);
        await userRepository.markLogin(user.id);
        logger.info({ userId: user.id }, 'uspjesna prijava');

        return {
          id: user.id,
          name: user.nickname,
          role: user.role,
          nickname: user.nickname,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],

  callbacks: {
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.role = user.role;
        token.nickname = user.nickname;
        token.mustChangePassword = user.mustChangePassword;
      }
      // Lets the password-change flow clear the flag without a re-login.
      if (trigger === 'update' && session && typeof session === 'object') {
        const patch = session as { mustChangePassword?: boolean; nickname?: string };
        if (typeof patch.mustChangePassword === 'boolean') {
          token.mustChangePassword = patch.mustChangePassword;
        }
        if (typeof patch.nickname === 'string') token.nickname = patch.nickname;
      }
      return token;
    },

    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      session.user.role = token.role ?? 'USER';
      session.user.nickname = token.nickname ?? session.user.name ?? '';
      session.user.mustChangePassword = token.mustChangePassword ?? false;
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
