import { computeStreaks, type StreakInput } from './streaks';

/**
 * Season statistics for one user, computed from their scored history.
 *
 * `played` counts matches the user actually predicted; accuracy and average are
 * measured against that, because being punished twice for a missed round (once
 * in points, once in percentage) reads as unfair.
 */
export interface ScoredMatch {
  readonly matchId: string;
  readonly kickoffAt: Date;
  readonly opponent: string;
  readonly predicted: boolean;
  readonly points: number;
  readonly exact: boolean;
}

export interface UserStats {
  readonly points: number;
  readonly played: number;
  readonly missed: number;
  readonly exactHits: number;
  readonly accuracyPct: number;
  readonly avgPoints: number;
  readonly currentStreak: number;
  readonly bestStreak: number;
  readonly worstStreak: number;
  readonly lastPredictionAt: Date | null;
  /** Cumulative points after each scored match, for the season chart. */
  readonly progression: readonly { matchId: string; kickoffAt: Date; opponent: string; points: number; cumulative: number }[];
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function computeUserStats(history: readonly ScoredMatch[]): UserStats {
  const chronological = [...history].sort(
    (a, b) => a.kickoffAt.getTime() - b.kickoffAt.getTime(),
  );

  let points = 0;
  let played = 0;
  let missed = 0;
  let exactHits = 0;
  let lastPredictionAt: Date | null = null;

  const progression: {
    matchId: string;
    kickoffAt: Date;
    opponent: string;
    points: number;
    cumulative: number;
  }[] = [];

  for (const match of chronological) {
    points += match.points;

    if (match.predicted) {
      played += 1;
      lastPredictionAt = match.kickoffAt;
    } else {
      missed += 1;
    }

    if (match.exact) exactHits += 1;

    progression.push({
      matchId: match.matchId,
      kickoffAt: match.kickoffAt,
      opponent: match.opponent,
      points: match.points,
      cumulative: points,
    });
  }

  const streakInput: StreakInput[] = chronological.map((m) => ({
    points: m.points,
    predicted: m.predicted,
  }));
  const streaks = computeStreaks(streakInput);

  return {
    points,
    played,
    missed,
    exactHits,
    // Guard against division by zero for a brand-new player.
    accuracyPct: played === 0 ? 0 : round1((exactHits / played) * 100),
    avgPoints: played === 0 ? 0 : round1(points / played),
    currentStreak: streaks.current,
    bestStreak: streaks.best,
    worstStreak: streaks.worst,
    lastPredictionAt,
    progression,
  };
}
