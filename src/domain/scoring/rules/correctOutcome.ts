import { isExactHit, outcomeOf, type ScoringRule } from '../ScoringRule';

/**
 * Pripremljeno za buduce sezone: pogoden ishod (pobjeda/remi/poraz) koji NIJE
 * ujedno i tocan rezultat nosi 1 bod. Ne aktivira se dok se njegov id ne doda
 * u `Season.scoringRuleIds`.
 */
export const correctOutcomeRule: ScoringRule = {
  id: 'correct-outcome',
  label: 'Pogođen ishod',
  applies: (ctx) =>
    !isExactHit(ctx) && outcomeOf(ctx.prediction) === outcomeOf(ctx.result),
  points: () => 1,
};
