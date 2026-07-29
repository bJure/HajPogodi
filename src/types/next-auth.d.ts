import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: 'ADMIN' | 'USER';
      nickname: string;
      mustChangePassword: boolean;
      /** `iat` of the underlying JWT, in seconds. */
      tokenIssuedAt: number;
    } & DefaultSession['user'];
  }

  interface User {
    role: 'ADMIN' | 'USER';
    nickname: string;
    mustChangePassword: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: 'ADMIN' | 'USER';
    nickname?: string;
    mustChangePassword?: boolean;
  }
}

export {};
