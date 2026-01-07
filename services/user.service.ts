import type { PrismaClient } from '@prisma/client';

export default class UserService {
  private prismaClient: PrismaClient;

  constructor({ prismaClient }: { prismaClient: PrismaClient }) {
    this.prismaClient = prismaClient;
  }

  async createUser(email: string, name?: string) {
    return await this.prismaClient.user.create({
      data: {
        email,
        name,
      },
    });
  }

  async findUserByEmail(email: string) {
    return await this.prismaClient.user.findUnique({
      where: { email },
    });
  }

  async getAllUsers() {
    return await this.prismaClient.user.findMany();
  }

  async updateUser(id: string, data: { name?: string; email?: string }) {
    return await this.prismaClient.user.update({
      where: { id },
      data,
    });
  }

  async deleteUser(id: string) {
    return await this.prismaClient.user.delete({
      where: { id },
    });
  }
}
