/**
 * Turns a user's standing into a small set of named signals, which is all the
 * message composer is allowed to look at. Keeping this step separate means the
 * tone rules stay readable and every branch is trivially testable.
 */

export interface RoastContext {
  readonly nickname: string;
  readonly rank: number;
  readonly totalPlayers: number;
  readonly points: number;
  readonly gapToLeader: number;
  readonly gapToNext: number;
  /** Points earned in the last three scored matches, newest last. */
  readonly lastThree: readonly number[];
  readonly accuracyPct: number;
  readonly scorelessStreak: number;
  readonly hitStreak: number;
  readonly matchesPlayed: number;
  /** Positive when the user climbed since the previous scoring run. */
  readonly rankDelta: number;
}

export type Position = 'LEADER' | 'PODIUM' | 'MID' | 'LOWER' | 'LAST';
export type Form = 'ON_FIRE' | 'WARM' | 'FLAT' | 'COLD' | 'FROZEN';

export interface RoastSignals {
  readonly position: Position;
  readonly form: Form;
  readonly isRookie: boolean;
  readonly isSoloPlayer: boolean;
  readonly justClimbed: boolean;
  readonly justDropped: boolean;
  readonly breathingDownNeck: boolean;
  readonly leaderOutOfReach: boolean;
  readonly perfectAccuracy: boolean;
  readonly zeroPoints: boolean;
}

/** Below this many scored matches a user is still treated as new. */
export const ROOKIE_THRESHOLD = 3;

function positionOf(rank: number, total: number): Position {
  if (total <= 1) return 'LEADER';
  if (rank === 1) return 'LEADER';
  if (rank === total) return 'LAST';
  if (rank <= 3) return 'PODIUM';
  // Bottom third, but not dead last.
  if (rank > Math.ceil((total * 2) / 3)) return 'LOWER';
  return 'MID';
}

function formOf(lastThree: readonly number[], hitStreak: number, scorelessStreak: number): Form {
  if (hitStreak >= 3) return 'ON_FIRE';
  if (scorelessStreak >= 6) return 'FROZEN';
  if (scorelessStreak >= 3) return 'COLD';

  const recent = lastThree.reduce((sum, p) => sum + p, 0);
  if (recent >= 2) return 'WARM';
  if (recent === 0 && lastThree.length > 0) return 'COLD';
  return 'FLAT';
}

export function extractSignals(ctx: RoastContext): RoastSignals {
  const position = positionOf(ctx.rank, ctx.totalPlayers);

  return {
    position,
    form: formOf(ctx.lastThree, ctx.hitStreak, ctx.scorelessStreak),
    isRookie: ctx.matchesPlayed < ROOKIE_THRESHOLD,
    isSoloPlayer: ctx.totalPlayers <= 1,
    justClimbed: ctx.rankDelta > 0,
    justDropped: ctx.rankDelta < 0,
    // Someone is within a single exact hit of overtaking.
    breathingDownNeck: position !== 'LAST' && ctx.gapToNext <= 1,
    leaderOutOfReach: position !== 'LEADER' && ctx.gapToLeader >= 5,
    perfectAccuracy: ctx.matchesPlayed >= ROOKIE_THRESHOLD && ctx.accuracyPct >= 100,
    zeroPoints: ctx.points === 0,
  };
}
