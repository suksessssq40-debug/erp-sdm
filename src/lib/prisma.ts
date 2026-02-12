// Force reload 4 - Final Sync
import 'dotenv/config'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const connectionString = process.env.DATABASE_URL

const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)


const globalForPrisma = global as unknown as { prisma: PrismaClient }

// FORCE RESET for development if model is missing
if (process.env.NODE_ENV !== 'production' && globalForPrisma.prisma) {
  // @ts-ignore - check if model exists, if not, reset
  if (!globalForPrisma.prisma.rentalPsPrice) {
    console.log('--- FORCING PRISMA RELOAD: RentalPsPrice model missing in cache ---');
    // @ts-ignore
    globalForPrisma.prisma.$disconnect();
    // @ts-ignore
    delete globalForPrisma.prisma;
  }
}

export const prisma = globalForPrisma.prisma || new PrismaClient({
  adapter,
  log: ['query', 'error', 'warn']
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
