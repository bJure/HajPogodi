import 'server-only';
import type { FixtureDto, FootballApiPort } from '@/application/ports/services';
import type { MatchRow } from '@/application/ports/repositories';
import { logger } from '@/infrastructure/logging/logger';
import { shortenTeamName } from '@/infrastructure/football/apiFootballClient';
import { compositeFootballApi } from '@/infrastructure/football/compositeClient';
import {
  competitionRepository,
  matchRepository,
  seasonRepository,
  teamRepository,
} from '@/infrastructure/repositories/matchRepository';
import { notificationRepository } from '@/infrastructure/repositories/supportRepositories';
import { userRepository } from '@/infrastructure/repositories/userRepository';

/**
 * Pulls Hajduk's schedule so the admin never types a fixture by hand.
 *
 * New fixtures land as NEEDS_CONFIRMATION: they are invisible to players until
 * an admin confirms them. That keeps a provider glitch - a wrong kickoff time,
 * a duplicated friendly - from opening predictions on a match that does not
 * exist.
 *
 * Fields an admin has edited are listed in `manualOverrides` and are never
 * overwritten by a later sync, so a manual correction survives.
 */
export interface SyncFixturesSummary {
  readonly fetched: number;
  readonly created: number;
  readonly updated: number;
  readonly skipped: number;
}

/** Fields the admin may override; sync respects these. */
const OVERRIDABLE = ['kickoffAt', 'competitionId', 'opponentId', 'isHome', 'round', 'venue'] as const;

export async function runSyncFixtures(
  api: FootballApiPort = compositeFootballApi,
): Promise<SyncFixturesSummary> {
  const season = await seasonRepository.findActive();
  if (!season) {
    logger.warn('sinkronizacija preskocena: nema aktivne sezone');
    return { fetched: 0, created: 0, updated: 0, skipped: 0 };
  }

  const fixtures = await api.listSeasonFixtures(season.apiYear);
  logger.info({ seasonId: season.id, fetched: fixtures.length }, 'raspored dohvacen');

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const newlyCreated: { matchId: string; opponent: string; kickoffAt: Date }[] = [];

  for (const fixture of fixtures) {
    const [opponent, competition] = await Promise.all([
      teamRepository.upsertByApiTeamId({
        apiFootballTeamId: fixture.opponent.apiTeamId,
        name: fixture.opponent.name,
        shortName: shortenTeamName(fixture.opponent.name),
        logoUrl: fixture.opponent.logoUrl,
      }),
      competitionRepository.upsertByApiLeagueId({
        apiFootballLeagueId: fixture.competition.apiLeagueId,
        name: fixture.competition.name,
        shortName: fixture.competition.name.slice(0, 12),
        type: fixture.competition.type,
        logoUrl: fixture.competition.logoUrl,
      }),
    ]);

    const existing = await matchRepository.findByFixtureId(fixture.fixtureId);

    if (!existing) {
      const match = await matchRepository.create({
        seasonId: season.id,
        competitionId: competition.id,
        opponentId: opponent.id,
        isHome: fixture.isHome,
        kickoffAt: fixture.kickoffAt,
        round: fixture.round,
        venue: fixture.venue,
        syncState: 'NEEDS_CONFIRMATION',
        apiFootballFixtureId: fixture.fixtureId,
        createdById: null,
      });

      created += 1;
      newlyCreated.push({
        matchId: match.id,
        opponent: opponent.shortName,
        kickoffAt: fixture.kickoffAt,
      });
      continue;
    }

    const patch = buildPatch(existing, fixture, competition.id, opponent.id);
    if (Object.keys(patch).length === 0) {
      skipped += 1;
      continue;
    }

    await matchRepository.update(existing.id, patch);
    updated += 1;
  }

  await notifyNewMatches(newlyCreated);

  const summary = { fetched: fixtures.length, created, updated, skipped };
  logger.info(summary, 'sinkronizacija rasporeda gotova');
  return summary;
}

/**
 * Computes the minimal update, skipping anything the admin has taken ownership
 * of and anything already equal.
 */
function buildPatch(
  existing: MatchRow,
  fixture: FixtureDto,
  competitionId: string,
  opponentId: string,
): Record<string, unknown> {
  const overridden = new Set(existing.manualOverrides);
  const patch: Record<string, unknown> = {};

  const candidates: Record<(typeof OVERRIDABLE)[number], unknown> = {
    kickoffAt: fixture.kickoffAt,
    competitionId,
    opponentId,
    isHome: fixture.isHome,
    round: fixture.round,
    venue: fixture.venue,
  };

  const current: Record<(typeof OVERRIDABLE)[number], unknown> = {
    kickoffAt: existing.kickoffAt,
    competitionId: existing.competitionId,
    opponentId: existing.opponentId,
    isHome: existing.isHome,
    round: existing.round,
    venue: existing.venue,
  };

  for (const field of OVERRIDABLE) {
    if (overridden.has(field)) continue;

    const next = candidates[field];
    const now = current[field];
    const changed =
      next instanceof Date && now instanceof Date ? next.getTime() !== now.getTime() : next !== now;

    if (changed) patch[field] = next;
  }

  // Status always follows the provider - it is never something an admin owns,
  // and a postponement must propagate even to an edited match.
  if (existing.status !== fixture.status && existing.status !== 'FINISHED') {
    patch.status = fixture.status;
  }

  return patch;
}

async function notifyNewMatches(
  matches: { matchId: string; opponent: string; kickoffAt: Date }[],
): Promise<void> {
  if (matches.length === 0) return;

  // Only admins hear about unconfirmed fixtures - players must not learn about
  // a match before it has been checked.
  const users = await userRepository.listActive();
  const admins = users.filter((user) => user.role === 'ADMIN');
  if (admins.length === 0) return;

  await notificationRepository.createMany(
    admins.flatMap((admin) =>
      matches.map((match) => ({
        userId: admin.id,
        type: 'MATCH_OPEN' as const,
        title: 'Nova utakmica u rasporedu',
        body: `${match.opponent} — ${match.kickoffAt.toLocaleDateString('hr-HR')}. Čeka potvrdu.`,
        matchId: match.matchId,
      })),
    ),
  );
}
