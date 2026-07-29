import type { ScoringRule } from '../ScoringRule';
import { exactScoreRule } from './exactScore';
import { correctOutcomeRule } from './correctOutcome';
import { goalDifferenceRule } from './goalDifference';

/**
 * Registry of every rule the system knows about.
 *
 * Only the ids listed on a `Season` are actually applied, so rules can be added
 * here long before any season switches them on. `exact-score` is the only rule
 * active in v1; the other two exist to prove the extension path works and are
 * covered by tests.
 */
export const SCORING_RULES: readonly ScoringRule[] = [
  exactScoreRule,
  correctOutcomeRule,
  goalDifferenceRule,
];

const BY_ID = new Map(SCORING_RULES.map((rule) => [rule.id, rule]));

export function getRule(id: string): ScoringRule | undefined {
  return BY_ID.get(id);
}

/**
 * Resolves season rule ids into rule objects, silently skipping unknown ids so
 * that removing a rule from the codebase cannot break scoring for old seasons.
 */
export function resolveRules(ids: readonly string[]): ScoringRule[] {
  return ids.map((id) => BY_ID.get(id)).filter((rule): rule is ScoringRule => rule !== undefined);
}

export const DEFAULT_RULE_IDS: readonly string[] = [exactScoreRule.id];

export { exactScoreRule, correctOutcomeRule, goalDifferenceRule };
