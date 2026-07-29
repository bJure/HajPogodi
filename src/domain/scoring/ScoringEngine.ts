import type { RuleHit, ScoreBreakdown, ScoringContext, ScoringRule } from './ScoringRule';
import { resolveRules } from './rules';

/**
 * Runs a set of rules over one prediction and returns the total plus the
 * breakdown. Pure - no I/O, no clock, no randomness - so scoring is fully
 * reproducible and a match can be re-scored at any time with identical output.
 */
export function score(ctx: ScoringContext, rules: readonly ScoringRule[]): ScoreBreakdown {
  const hits: RuleHit[] = [];

  for (const rule of rules) {
    if (!rule.applies(ctx)) continue;
    const points = rule.points(ctx);
    if (points === 0) continue;
    hits.push({ ruleId: rule.id, label: rule.label, points });
  }

  const total = hits.reduce((sum, hit) => sum + hit.points, 0);
  return { total, hits };
}

/** Convenience overload that resolves rule ids from a season. */
export function scoreWithRuleIds(
  ctx: ScoringContext,
  ruleIds: readonly string[],
): ScoreBreakdown {
  return score(ctx, resolveRules(ruleIds));
}
