import { describe, expect, it } from 'vitest';
import { computeStreaks, hitStreak, scorelessStreak } from '@/domain/stats/streaks';
import { computeUserStats, type ScoredMatch } from '@/domain/stats/computeUserStats';

function match(overrides: Partial<ScoredMatch> & { day: number }): ScoredMatch {
  const { day, ...rest } = overrides;
  return {
    matchId: `m${day}`,
    kickoffAt: new Date(Date.UTC(2026, 8, day)),
    opponent: 'Rijeka',
    predicted: true,
    points: 0,
    exact: false,
    ...rest,
  };
}

describe('nizovi', () => {
  it('broji trenutni niz pozitivno za pogotke, negativno za promasaje', () => {
    const streaks = computeStreaks([
      { points: 1, predicted: true },
      { points: 1, predicted: true },
      { points: 0, predicted: true },
    ]);

    expect(streaks.current).toBe(-1);
    expect(streaks.best).toBe(2);
    expect(streaks.worst).toBe(1);
  });

  it('propustena prognoza prekida niz, jer preskakanje kola ne smije stititi niz', () => {
    const streaks = computeStreaks([
      { points: 1, predicted: true },
      { points: 0, predicted: false },
      { points: 1, predicted: true },
    ]);

    expect(streaks.best).toBe(1);
    expect(streaks.current).toBe(1);
  });

  it('vraca nule za praznu povijest', () => {
    expect(computeStreaks([])).toEqual({ current: 0, best: 0, worst: 0 });
  });

  it('izdvaja niz bez bodova i niz pogodaka kao nenegativne brojeve', () => {
    const cold = [
      { points: 1, predicted: true },
      { points: 0, predicted: true },
      { points: 0, predicted: true },
    ];

    expect(scorelessStreak(cold)).toBe(2);
    expect(hitStreak(cold)).toBe(0);
  });
});

describe('statistika korisnika', () => {
  it('racuna bodove, tocnost i prosjek samo po odigranim prognozama', () => {
    const stats = computeUserStats([
      match({ day: 1, points: 1, exact: true }),
      match({ day: 2, points: 0 }),
      match({ day: 3, predicted: false }),
      match({ day: 4, points: 1, exact: true }),
    ]);

    expect(stats.points).toBe(2);
    expect(stats.played).toBe(3);
    expect(stats.missed).toBe(1);
    expect(stats.exactHits).toBe(2);
    // 2 pogotka na 3 odigrane prognoze - propusteno kolo se ne kaznjava dvaput.
    expect(stats.accuracyPct).toBeCloseTo(66.7, 1);
    expect(stats.avgPoints).toBeCloseTo(0.7, 1);
  });

  it('ne dijeli s nulom za korisnika bez ijedne prognoze', () => {
    const stats = computeUserStats([match({ day: 1, predicted: false })]);

    expect(stats.accuracyPct).toBe(0);
    expect(stats.avgPoints).toBe(0);
    expect(Number.isNaN(stats.accuracyPct)).toBe(false);
  });

  it('gradi kumulativni tijek bodova za graf sezone', () => {
    const stats = computeUserStats([
      match({ day: 3, points: 1, exact: true }),
      match({ day: 1, points: 1, exact: true }),
      match({ day: 2, points: 0 }),
    ]);

    // Ulaz je namjerno neuredan - graf mora biti kronoloski.
    expect(stats.progression.map((p) => p.cumulative)).toEqual([1, 1, 2]);
    expect(stats.progression.map((p) => p.matchId)).toEqual(['m1', 'm2', 'm3']);
  });

  it('pamti vrijeme zadnje prognoze, ali ne i propustenih kola', () => {
    const stats = computeUserStats([
      match({ day: 1, points: 1, exact: true }),
      match({ day: 9, predicted: false }),
    ]);

    expect(stats.lastPredictionAt).toEqual(new Date(Date.UTC(2026, 8, 1)));
  });

  it('vraca prazne vrijednosti za praznu povijest', () => {
    const stats = computeUserStats([]);

    expect(stats.points).toBe(0);
    expect(stats.progression).toHaveLength(0);
    expect(stats.lastPredictionAt).toBeNull();
  });
});
