import 'server-only';
import type { UserRepository } from '@/application/ports/repositories';
import { prisma } from '@/infrastructure/db/prisma';

export const userRepository: UserRepository = {
  findById: (id) => prisma.user.findUnique({ where: { id } }),

  findByUsername: (username) => prisma.user.findUnique({ where: { username } }),

  list: () =>
    prisma.user.findMany({ orderBy: [{ role: 'asc' }, { nickname: 'asc' }] }),

  listActive: () =>
    prisma.user.findMany({ where: { isActive: true }, orderBy: { nickname: 'asc' } }),

  create: (data) =>
    prisma.user.create({
      data: {
        username: data.username,
        passwordHash: data.passwordHash,
        nickname: data.nickname,
        role: data.role,
        createdById: data.createdById,
        updatedById: data.createdById,
      },
    }),

  update: (id, data) =>
    prisma.user.update({
      where: { id },
      data: { nickname: data.nickname, role: data.role, updatedById: data.updatedById },
    }),

  setActive: (id, isActive, updatedById) =>
    prisma.user.update({ where: { id }, data: { isActive, updatedById } }),

  // `passwordChangedAt` is what invalidates tokens issued before this moment,
  // so it is written here rather than left to callers to remember.
  setPassword: (id, passwordHash, mustChangePassword, updatedById) =>
    prisma.user.update({
      where: { id },
      data: { passwordHash, mustChangePassword, updatedById, passwordChangedAt: new Date() },
    }),

  markLogin: async (id) => {
    await prisma.user.update({ where: { id }, data: { lastLoginAt: new Date() } });
  },

  delete: async (id) => {
    await prisma.user.delete({ where: { id } });
  },

  countAdmins: (excludingId) =>
    prisma.user.count({
      where: {
        role: 'ADMIN',
        isActive: true,
        ...(excludingId ? { id: { not: excludingId } } : {}),
      },
    }),
};
