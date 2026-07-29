/**
 * Streak arithmetic over a chronologically ordered list of scored matches.
 *
 * A "hit" is any match where the user earned points. Matches the user never
 * predicted count as misses - skipping a round should not protect a streak.
 */

export interface StreakInput {
  /** Points earned; a match the user did not predict contributes 0. */
  readonly points: number;
  readonly predicted: boolean;
}

export interface Streaks {
  /** Length of the current run, positive for hits, negative for misses. */
  readonly current: number;
  /** Longest run of consecutive hits. */
  readonly best: number;
  /** Longest run of consecutive misses, as a positive number. */
  readonly worst: number;
}

export function computeStreaks(history: readonly StreakInput[]): Streaks {
  let best = 0;
  let worst = 0;
  let runHits = 0;
  let runMisses = 0;
  let current = 0;

  for (const entry of history) {
    const hit = entry.predicted && entry.points > 0;

    if (hit) {
      runHits += 1;
      runMisses = 0;
      if (runHits > best) best = runHits;
      current = runHits;
    } else {
      runMisses += 1;
      runHits = 0;
      if (runMisses > worst) worst = runMisses;
      current = -runMisses;
    }
  }

  return { current, best, worst };
}

/** Consecutive pointless matches at the end of the history. */
export function scorelessStreak(history: readonly StreakInput[]): number {
  const { current } = computeStreaks(history);
  return current < 0 ? -current : 0;
}

/** Consecutive scoring matches at the end of the history. */
export function hitStreak(history: readonly StreakInput[]): number {
  const { current } = computeStreaks(history);
  return current > 0 ? current : 0;
}
