import { PrismaClient } from '../generated/prisma';

let prismaClient: PrismaClient | null = null;

export class PrismaService {
  private static instance: PrismaClient;

  static getInstance(): PrismaClient {
    if (!PrismaService.instance) {
      PrismaService.instance = new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
      });
    }
    return PrismaService.instance;
  }

  static async disconnect(): Promise<void> {
    if (PrismaService.instance) {
      await PrismaService.instance.$disconnect();
    }
  }
}

// Export singleton instance for Awilix
export const createPrismaClient = (): PrismaClient => {
  if (!prismaClient) {
    prismaClient = PrismaService.getInstance();
  }
  return prismaClient;
};

// Graceful shutdown
process.on('beforeExit', async () => {
  await PrismaService.disconnect();
});
