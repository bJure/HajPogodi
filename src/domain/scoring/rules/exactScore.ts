import { isExactHit, type ScoringRule } from '../ScoringRule';

/**
 * v1 pravilo: tocan rezultat nosi 1 bod, sve ostalo 0.
 */
export const exactScoreRule: ScoringRule = {
  id: 'exact-score',
  label: 'Točan rezultat',
  applies: isExactHit,
  points: () => 1,
};
