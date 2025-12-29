import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Prisma Client singleton pattern - recommended by Prisma for Next.js
// This prevents creating multiple instances which can exhaust database connections
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

// Cache the Prisma client in the global object to reuse across hot reloads and requests
// This is safe and recommended for both development and production
if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = prisma
} 