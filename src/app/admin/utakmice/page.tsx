import type { Metadata } from 'next';
import { listSeasonMatches } from '@/application/services/matchService';
import { Card } from '@/components/ui/Card';
import { requirePageAdmin } from '@/infrastructure/auth/session';
import {
  competitionRepository,
  seasonRepository,
  teamRepository,
} from '@/infrastructure/repositories/matchRepository';
import { MatchManager } from './MatchManager';

export const metadata: Metadata = { title: 'Utakmice' };
export const dynamic = 'force-dynamic';

export default async function AdminMatchesPage() {
  await requirePageAdmin();
  const season = await seasonRepository.findActive();

  if (!season) {
    return (
      <Card className="text-center">
        <p className="text-sm text-ink-muted">
          Nema aktivne sezone. Otvori je u kartici Sezone prije unosa utakmica.
        </p>
      </Card>
    );
  }

  const now = new Date();
  const [matches, competitions, teams] = await Promise.all([
    listSeasonMatches(season.id, now),
    competitionRepository.list(),
    teamRepository.list(),
  ]);

  return (
    <MatchManager
      matches={matches}
      seasonId={season.id}
      seasonName={season.name}
      competitions={competitions.map((competition) => ({
        id: competition.id,
        name: competition.name,
        shortName: competition.shortName,
        type: competition.type,
      }))}
      // Our own club is never a valid opponent.
      teams={teams
        .filter((team) => !team.isOurClub)
        .map((team) => ({
          id: team.id,
          name: team.name,
          shortName: team.shortName,
          logoUrl: team.logoUrl,
        }))}
    />
  );
}
