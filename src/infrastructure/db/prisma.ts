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

let client: PrismaClient | undefined = globalForPrisma.prisma;

function getClient(): PrismaClient {
  if (!client) {
    client = createClient();
    if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = client;
  }
  return client;
}

/**
 * A proxy rather than the client itself, because constructing the client reads
 * DATABASE_URL. `next build` imports this module while collecting page data,
 * when no database configuration needs to exist yet; the first real property
 * access - which only happens while serving a request or running a job -
 * builds the client and fails loudly there if configuration is missing.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const target = getClient();
    const value = Reflect.get(target, property, target);
    return typeof value === 'function' ? value.bind(target) : value;
  },
});

/** Transaction client type, for services that accept either. */
export type PrismaTransaction = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;
