import { PrismaClient } from '@prisma/client';

let prismaClientSingleton: PrismaClient | null = null;

function getPrismaClient() {
  if (!prismaClientSingleton) {
    prismaClientSingleton = new PrismaClient();
  }
  return prismaClientSingleton;
}

export const prisma = getPrismaClient();