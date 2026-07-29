import 'server-only';
import { PrismaClient } from '@prisma/client';
import { getEnv } from '@/lib/env';

/**
 * One Prisma client per process. In development Next reloads modules on every
 * change, so the instance is parked on globalThis to avoid exhausting the
 * connection pool with orphaned clients.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const env = getEnv();
  return new PrismaClient({
    datasources: { db: { url: env.DATABASE_URL } },
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/** Transaction client type, for services that accept either. */
export type PrismaTransaction = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;
