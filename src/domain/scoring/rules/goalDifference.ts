import { isExactHit, type ScoringRule } from '../ScoringRule';

/**
 * Pripremljeno za buduce sezone: pogodena gol-razlika koja nije tocan rezultat
 * nosi 1 bod. Neaktivno dok se ne doda u `Season.scoringRuleIds`.
 */
export const goalDifferenceRule: ScoringRule = {
  id: 'goal-difference',
  label: 'Pogođena gol-razlika',
  applies: (ctx) => {
    if (isExactHit(ctx)) return false;
    const predicted = ctx.prediction.homeGoals - ctx.prediction.awayGoals;
    const actual = ctx.result.homeGoals - ctx.result.awayGoals;
    return predicted === actual;
  },
  points: () => 1,
};
