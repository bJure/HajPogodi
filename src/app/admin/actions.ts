'use server';

import { revalidatePath } from 'next/cache';
import {
  createUserSchema,
  deleteUserSchema,
  resetPasswordSchema,
  toggleActiveSchema,
  updateUserSchema,
} from '@/application/dto/user';
import {
  confirmMatchSchema,
  createMatchSchema,
  deleteMatchSchema,
  setLockSchema,
  setResultSchema,
  updateMatchSchema,
} from '@/application/dto/match';
import {
  activateSeasonSchema,
  createSeasonSchema,
  updateSeasonSchema,
} from '@/application/dto/season';
import {
  createUser,
  deleteUser,
  resetUserPassword,
  setUserActive,
  updateUser,
} from '@/application/services/userService';
import {
  confirmMatch,
  createMatch,
  deleteMatch,
  setMatchLock,
  setMatchResult,
  updateMatch,
} from '@/application/services/matchService';
import {
  activateSeason,
  createSeason,
  updateSeason,
} from '@/application/services/seasonService';
import { recalculateLeaderboard } from '@/application/services/leaderboardService';
import { evaluateSeasonAchievements } from '@/application/services/scoringService';
import { runSyncFixtures } from '@/infrastructure/jobs/syncFixturesJob';
import { requireAdmin } from '@/infrastructure/auth/session';
import { actionOk, parseInput, withAction, type ActionResult } from '@/lib/action';
import { isFootballApiEnabled } from '@/lib/env';
import { Errors } from '@/domain/shared/DomainError';
import { throwDomain } from '@/lib/action';

/**
 * Admin server actions.
 *
 * Every one of them starts with `requireAdmin()`, which re-reads the user from
 * the database. Middleware already redirected non-admins away from the page,
 * but that is a convenience - this line is the actual authorization.
 */

function revalidateAdmin(...paths: string[]): void {
  for (const path of paths) revalidatePath(path);
}

// ------------------------------------------------------------------ korisnici

export async function createUserAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  return withAction('admin/createUser', async () => {
    const admin = await requireAdmin();
    const input = parseInput(createUserSchema, {
      username: formData.get('username'),
      password: formData.get('password'),
      nickname: formData.get('nickname'),
      role: formData.get('role') ?? 'USER',
    });

    const user = await createUser(admin.id, input);
    revalidateAdmin('/admin/korisnici', '/ljestvica');
    return actionOk({ id: user.id });
  });
}

export async function updateUserAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  return withAction('admin/updateUser', async () => {
    const admin = await requireAdmin();
    const input = parseInput(updateUserSchema, {
      id: formData.get('id'),
      nickname: formData.get('nickname'),
      role: formData.get('role'),
    });

    const user = await updateUser(admin.id, input);
    revalidateAdmin('/admin/korisnici', '/ljestvica');
    return actionOk({ id: user.id });
  });
}

export async function toggleUserActiveAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  return withAction('admin/toggleUserActive', async () => {
    const admin = await requireAdmin();
    const input = parseInput(toggleActiveSchema, {
      id: formData.get('id'),
      isActive: formData.get('isActive') === 'true',
    });

    const user = await setUserActive(admin.id, input);
    revalidateAdmin('/admin/korisnici', '/ljestvica');
    return actionOk({ id: user.id });
  });
}

export async function resetPasswordAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  return withAction('admin/resetPassword', async () => {
    const admin = await requireAdmin();
    const input = parseInput(resetPasswordSchema, {
      id: formData.get('id'),
      newPassword: formData.get('newPassword'),
    });

    const user = await resetUserPassword(admin.id, input);
    revalidateAdmin('/admin/korisnici');
    return actionOk({ id: user.id });
  });
}

export async function deleteUserAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  return withAction('admin/deleteUser', async () => {
    const admin = await requireAdmin();
    const input = parseInput(deleteUserSchema, { id: formData.get('id') });

    await deleteUser(admin.id, input.id);
    revalidateAdmin('/admin/korisnici', '/ljestvica');
    return actionOk({ id: input.id });
  });
}

// ------------------------------------------------------------------- utakmice

export async function createMatchAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  return withAction('admin/createMatch', async () => {
    const admin = await requireAdmin();
    const input = parseInput(createMatchSchema, {
      seasonId: formData.get('seasonId'),
      competitionId: formData.get('competitionId'),
      opponentId: formData.get('opponentId'),
      isHome: formData.get('isHome') === 'true',
      kickoffAt: formData.get('kickoffAt'),
      round: formData.get('round') || undefined,
      venue: formData.get('venue') || undefined,
    });

    const id = await createMatch(admin.id, input);
    revalidateAdmin('/admin/utakmice', '/pocetna');
    return actionOk({ id });
  });
}

export async function updateMatchAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  return withAction('admin/updateMatch', async () => {
    const admin = await requireAdmin();
    const input = parseInput(updateMatchSchema, {
      id: formData.get('id'),
      seasonId: formData.get('seasonId'),
      competitionId: formData.get('competitionId'),
      opponentId: formData.get('opponentId'),
      isHome: formData.get('isHome') === 'true',
      kickoffAt: formData.get('kickoffAt'),
      round: formData.get('round') || undefined,
      venue: formData.get('venue') || undefined,
    });

    await updateMatch(admin.id, input);
    revalidateAdmin('/admin/utakmice', '/pocetna');
    return actionOk({ id: input.id });
  });
}

export async function confirmMatchAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  return withAction('admin/confirmMatch', async () => {
    const admin = await requireAdmin();
    const input = parseInput(confirmMatchSchema, { id: formData.get('id') });

    await confirmMatch(admin.id, input.id);
    revalidateAdmin('/admin/utakmice', '/pocetna');
    return actionOk({ id: input.id });
  });
}

export async function setMatchLockAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  return withAction('admin/setMatchLock', async () => {
    const admin = await requireAdmin();
    const raw = formData.get('lockOverride');
    const input = parseInput(setLockSchema, {
      id: formData.get('id'),
      lockOverride: raw === 'auto' || raw === null ? null : raw === 'true',
    });

    await setMatchLock(admin.id, input.id, input.lockOverride);
    revalidateAdmin('/admin/utakmice', '/pocetna');
    return actionOk({ id: input.id });
  });
}

export async function setMatchResultAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  return withAction('admin/setMatchResult', async () => {
    const admin = await requireAdmin();
    const input = parseInput(setResultSchema, {
      matchId: formData.get('matchId'),
      homeGoals: Number(formData.get('homeGoals')),
      awayGoals: Number(formData.get('awayGoals')),
      note: formData.get('note') || undefined,
    });

    await setMatchResult(admin.id, input);
    revalidateAdmin('/admin/utakmice', '/pocetna', '/ljestvica', '/povijest');
    return actionOk({ id: input.matchId });
  });
}

export async function deleteMatchAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  return withAction('admin/deleteMatch', async () => {
    const admin = await requireAdmin();
    const input = parseInput(deleteMatchSchema, { id: formData.get('id') });

    await deleteMatch(admin.id, input.id);
    revalidateAdmin('/admin/utakmice', '/pocetna', '/ljestvica');
    return actionOk({ id: input.id });
  });
}

// -------------------------------------------------------------------- sezone

export async function createSeasonAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  return withAction('admin/createSeason', async () => {
    const admin = await requireAdmin();
    const input = parseInput(createSeasonSchema, {
      name: formData.get('name'),
      apiYear: formData.get('apiYear'),
      startsAt: formData.get('startsAt'),
      endsAt: formData.get('endsAt'),
      scoringRuleIds: formData.getAll('scoringRuleIds').map(String),
    });

    const id = await createSeason(admin.id, input);
    revalidateAdmin('/admin/sezone');
    return actionOk({ id });
  });
}

export async function updateSeasonAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  return withAction('admin/updateSeason', async () => {
    const admin = await requireAdmin();
    const input = parseInput(updateSeasonSchema, {
      id: formData.get('id'),
      name: formData.get('name'),
      apiYear: formData.get('apiYear'),
      startsAt: formData.get('startsAt'),
      endsAt: formData.get('endsAt'),
      scoringRuleIds: formData.getAll('scoringRuleIds').map(String),
    });

    await updateSeason(admin.id, input);
    revalidateAdmin('/admin/sezone', '/ljestvica');
    return actionOk({ id: input.id });
  });
}

export async function activateSeasonAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  return withAction('admin/activateSeason', async () => {
    const admin = await requireAdmin();
    const input = parseInput(activateSeasonSchema, { id: formData.get('id') });

    await activateSeason(admin.id, input.id);
    revalidateAdmin('/admin/sezone', '/pocetna', '/ljestvica');
    return actionOk({ id: input.id });
  });
}

// ------------------------------------------------------------------ operacije

export async function syncFixturesAction(
  _prev: ActionResult<{ created: number; updated: number }> | null,
): Promise<ActionResult<{ created: number; updated: number }>> {
  return withAction('admin/syncFixtures', async () => {
    await requireAdmin();

    if (!isFootballApiEnabled()) {
      throwDomain(
        Errors.validation('API_FOOTBALL_KEY nije postavljen — sinkronizacija nije moguća.'),
      );
    }

    const summary = await runSyncFixtures();
    revalidateAdmin('/admin/utakmice', '/pocetna');
    return actionOk({ created: summary.created, updated: summary.updated });
  });
}

export async function recalculateAction(
  _prev: ActionResult<{ players: number }> | null,
  formData: FormData,
): Promise<ActionResult<{ players: number }>> {
  return withAction('admin/recalculate', async () => {
    await requireAdmin();
    const seasonId = String(formData.get('seasonId') ?? '');
    if (!seasonId) throwDomain(Errors.validation('Nedostaje sezona.'));

    const players = await recalculateLeaderboard(seasonId);
    await evaluateSeasonAchievements(seasonId);

    revalidateAdmin('/admin', '/ljestvica', '/pocetna');
    return actionOk({ players });
  });
}
