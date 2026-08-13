import { PrismaClient } from '@prisma/client';

// Reuse a single PrismaClient across hot reloads in development. Without this,
// Next.js spawns a new client (and connection pool) on every reload, which
// exhausts connections and locks the SQLite database.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
