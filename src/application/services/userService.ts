import 'server-only';
import { Errors } from '@/domain/shared/DomainError';
import type { UserDto } from '@/application/dto/user';
import type { UserRow } from '@/application/ports/repositories';
import { throwDomain } from '@/lib/action';
import { clientIp } from '@/infrastructure/auth/clientIp';
import { passwordHasher } from '@/infrastructure/auth/password';
import {
  checkPasswordChangeRateLimit,
  recordPasswordChangeAttempt,
  RATE_LIMIT_MESSAGE,
} from '@/infrastructure/auth/rateLimit';
import { auditRepository } from '@/infrastructure/repositories/supportRepositories';
import { userRepository } from '@/infrastructure/repositories/userRepository';
import { logger } from '@/infrastructure/logging/logger';

/**
 * User management use cases.
 *
 * Every mutation records an audit entry, and none of them ever return a
 * password hash - `toDto` is the only way a user leaves this module.
 */
export function toUserDto(row: UserRow): UserDto {
  return {
    id: row.id,
    username: row.username,
    nickname: row.nickname,
    role: row.role,
    isActive: row.isActive,
    mustChangePassword: row.mustChangePassword,
    lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listUsers(): Promise<UserDto[]> {
  const rows = await userRepository.list();
  return rows.map(toUserDto);
}

export async function createUser(
  actorId: string,
  input: { username: string; password: string; nickname: string; role: 'ADMIN' | 'USER' },
): Promise<UserDto> {
  const existing = await userRepository.findByUsername(input.username);
  if (existing) {
    throwDomain(
      Errors.validation('Korisničko ime je zauzeto.', { username: 'Korisničko ime je zauzeto.' }),
    );
  }

  const user = await userRepository.create({
    username: input.username,
    passwordHash: await passwordHasher.hash(input.password),
    nickname: input.nickname,
    role: input.role,
    createdById: actorId,
  });

  await auditRepository.record({
    actorId,
    action: 'USER_CREATE',
    entity: 'User',
    entityId: user.id,
    after: { username: user.username, nickname: user.nickname, role: user.role },
  });

  logger.info({ actorId, userId: user.id }, 'korisnik kreiran');
  return toUserDto(user);
}

export async function updateUser(
  actorId: string,
  input: { id: string; nickname: string; role: 'ADMIN' | 'USER' },
): Promise<UserDto> {
  const before = await userRepository.findById(input.id);
  if (!before) throwDomain(Errors.notFound('Korisnik'));

  // Demoting the last remaining admin would lock everyone out of the panel.
  if (before.role === 'ADMIN' && input.role === 'USER') {
    const otherAdmins = await userRepository.countAdmins(before.id);
    if (otherAdmins === 0) {
      throwDomain(Errors.conflict('Ovo je jedini administrator — ne može se pretvoriti u korisnika.'));
    }
  }

  const updated = await userRepository.update(input.id, {
    nickname: input.nickname,
    role: input.role,
    updatedById: actorId,
  });

  await auditRepository.record({
    actorId,
    action: 'USER_UPDATE',
    entity: 'User',
    entityId: updated.id,
    before: { nickname: before.nickname, role: before.role },
    after: { nickname: updated.nickname, role: updated.role },
  });

  return toUserDto(updated);
}

export async function setUserActive(
  actorId: string,
  input: { id: string; isActive: boolean },
): Promise<UserDto> {
  const before = await userRepository.findById(input.id);
  if (!before) throwDomain(Errors.notFound('Korisnik'));

  if (!input.isActive) {
    if (before.id === actorId) {
      throwDomain(Errors.conflict('Ne možeš deaktivirati vlastiti račun.'));
    }
    if (before.role === 'ADMIN' && (await userRepository.countAdmins(before.id)) === 0) {
      throwDomain(Errors.conflict('Ovo je jedini aktivni administrator.'));
    }
  }

  const updated = await userRepository.setActive(input.id, input.isActive, actorId);

  await auditRepository.record({
    actorId,
    action: input.isActive ? 'USER_ACTIVATE' : 'USER_DEACTIVATE',
    entity: 'User',
    entityId: updated.id,
    before: { isActive: before.isActive },
    after: { isActive: updated.isActive },
  });

  return toUserDto(updated);
}

export async function resetUserPassword(
  actorId: string,
  input: { id: string; newPassword: string },
): Promise<UserDto> {
  const user = await userRepository.findById(input.id);
  if (!user) throwDomain(Errors.notFound('Korisnik'));

  const updated = await userRepository.setPassword(
    input.id,
    await passwordHasher.hash(input.newPassword),
    // Forces the user to choose their own password on next login, so the
    // admin-known one is never the one that stays in use.
    true,
    actorId,
  );

  await auditRepository.record({
    actorId,
    action: 'USER_PASSWORD_RESET',
    entity: 'User',
    entityId: updated.id,
  });

  logger.info({ actorId, userId: updated.id }, 'lozinka resetirana');
  return toUserDto(updated);
}

export async function changeOwnPassword(
  userId: string,
  input: { currentPassword: string; newPassword: string },
): Promise<void> {
  const user = await userRepository.findById(userId);
  if (!user) throwDomain(Errors.notFound('Korisnik'));

  const ip = await clientIp();
  const limit = await checkPasswordChangeRateLimit(userId, ip);
  if (limit.blocked) {
    logger.warn({ userId, reason: limit.reason }, 'promjena lozinke blokirana zbog ogranicenja');
    throwDomain(Errors.rateLimited(RATE_LIMIT_MESSAGE));
  }

  const valid = await passwordHasher.verify(input.currentPassword, user.passwordHash);
  if (!valid) {
    await recordPasswordChangeAttempt(userId, ip, false);
    throwDomain(
      Errors.validation('Trenutna lozinka nije točna.', {
        currentPassword: 'Trenutna lozinka nije točna.',
      }),
    );
  }

  if (await passwordHasher.verify(input.newPassword, user.passwordHash)) {
    throwDomain(
      Errors.validation('Nova lozinka mora biti različita od trenutne.', {
        newPassword: 'Nova lozinka mora biti različita od trenutne.',
      }),
    );
  }

  await userRepository.setPassword(
    userId,
    await passwordHasher.hash(input.newPassword),
    false,
    userId,
  );
  await recordPasswordChangeAttempt(userId, ip, true);

  await auditRepository.record({
    actorId: userId,
    action: 'USER_PASSWORD_CHANGE',
    entity: 'User',
    entityId: userId,
  });
}

export async function deleteUser(actorId: string, id: string): Promise<void> {
  const user = await userRepository.findById(id);
  if (!user) throwDomain(Errors.notFound('Korisnik'));

  if (user.id === actorId) {
    throwDomain(Errors.conflict('Ne možeš obrisati vlastiti račun.'));
  }
  if (user.role === 'ADMIN' && (await userRepository.countAdmins(user.id)) === 0) {
    throwDomain(Errors.conflict('Ovo je jedini administrator.'));
  }

  // Deleting cascades to predictions, scores and leaderboard rows, so the audit
  // entry is written first - it is the only record that will survive.
  await auditRepository.record({
    actorId,
    action: 'USER_DELETE',
    entity: 'User',
    entityId: user.id,
    before: { username: user.username, nickname: user.nickname, role: user.role },
  });

  await userRepository.delete(id);
  logger.warn({ actorId, userId: id }, 'korisnik obrisan');
}
