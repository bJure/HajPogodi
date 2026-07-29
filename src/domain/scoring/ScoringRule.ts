/**
 * A single, independently testable scoring rule.
 *
 * Adding a rule for a future season means writing one file implementing this
 * interface, registering it, and listing its id on the season. No service, job
 * or component changes.
 */
export interface ScorePrediction {
  readonly homeGoals: number;
  readonly awayGoals: number;
}

export interface ScoreResult {
  readonly homeGoals: number;
  readonly awayGoals: number;
}

export interface ScoringContext {
  readonly prediction: ScorePrediction;
  readonly result: ScoreResult;
  /** True when Hajduk played at home - lets rules treat home/away asymmetrically. */
  readonly isHome: boolean;
  /** Competition type, so a future rule can weight derbies or Europe higher. */
  readonly competitionType: 'LEAGUE' | 'CUP' | 'EUROPE' | 'FRIENDLY';
}

export interface ScoringRule {
  readonly id: string;
  readonly label: string;
  /** Whether this rule fires for the given context. */
  applies(ctx: ScoringContext): boolean;
  /** Points awarded when it fires. Never called unless `applies` returned true. */
  points(ctx: ScoringContext): number;
}

/** One rule that fired, persisted alongside the score so the UI can explain it. */
export interface RuleHit {
  readonly ruleId: string;
  readonly label: string;
  readonly points: number;
}

export interface ScoreBreakdown {
  readonly total: number;
  readonly hits: readonly RuleHit[];
}

// ------------------------------------------------------------------ helpers

/** 1 = home win, 0 = draw, -1 = away win. */
export function outcomeOf(score: ScorePrediction | ScoreResult): -1 | 0 | 1 {
  if (score.homeGoals > score.awayGoals) return 1;
  if (score.homeGoals < score.awayGoals) return -1;
  return 0;
}

export function isExactHit(ctx: ScoringContext): boolean {
  return (
    ctx.prediction.homeGoals === ctx.result.homeGoals &&
    ctx.prediction.awayGoals === ctx.result.awayGoals
  );
}
