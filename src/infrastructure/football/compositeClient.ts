import 'server-only';
import type { FixtureDto, FootballApiPort } from '@/application/ports/services';
import { logger } from '@/infrastructure/logging/logger';
import { getEspnFixture, listEspnFixtures } from './espnClient';
import { getSemaforFixture, listSemaforFixtures } from './semaforClient';
import { isEspnId, isSemaforId } from './providerIds';

/**
 * The football port assembled from two sources, because no free source covers
 * both halves: HNS semafor has the domestic season and nothing else, ESPN has
 * the UEFA ties and no Croatian football at all.
 *
 * One source failing does not fail the sync. Syncing only creates and updates
 * matches - it never deletes - so a partial answer leaves the other half
 * untouched rather than wrong, and the failure is logged loudly enough to act
 * on. Failing both halves because one page changed would be the worse trade.
 */
async function collect(
  source: string,
  load: () => Promise<FixtureDto[]>,
): Promise<FixtureDto[]> {
  try {
    return await load();
  } catch (error) {
    logger.error({ err: error, source }, 'izvor rasporeda nije odgovorio');
    return [];
  }
}

export const compositeFootballApi: FootballApiPort = {
  async listSeasonFixtures() {
    const [domestic, european] = await Promise.all([
      collect('semafor', () => listSemaforFixtures()),
      collect('espn', () => listEspnFixtures()),
    ]);

    const fixtures = [...domestic, ...european];
    logger.info(
      { domestic: domestic.length, european: european.length },
      'raspored spojen iz oba izvora',
    );
    return fixtures;
  },

  async getFixture(fixtureId) {
    // The band the id was stored under says which provider owns it.
    if (isEspnId(fixtureId)) return getEspnFixture(fixtureId);
    if (isSemaforId(fixtureId)) return getSemaforFixture(fixtureId);

    logger.warn({ fixtureId }, 'nepoznat izvor za utakmicu');
    return null;
  },
};
