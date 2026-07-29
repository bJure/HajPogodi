import type { Metadata } from 'next';
import { SCORING_RULES } from '@/domain/scoring/rules';
import { listSeasons } from '@/application/services/seasonService';
import { requirePageAdmin } from '@/infrastructure/auth/session';
import { SeasonManager } from './SeasonManager';

export const metadata: Metadata = { title: 'Sezone' };
export const dynamic = 'force-dynamic';

export default async function AdminSeasonsPage() {
  await requirePageAdmin();
  const seasons = await listSeasons();

  return (
    <SeasonManager
      seasons={seasons}
      // Options come straight from the rule registry, so a newly written rule
      // shows up here without touching this page.
      rules={SCORING_RULES.map((rule) => ({ id: rule.id, label: rule.label }))}
    />
  );
}
