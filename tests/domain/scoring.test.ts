import { describe, expect, it } from 'vitest';
import { score, scoreWithRuleIds } from '@/domain/scoring/ScoringEngine';
import { DEFAULT_RULE_IDS, resolveRules, SCORING_RULES } from '@/domain/scoring/rules';
import { exactScoreRule } from '@/domain/scoring/rules/exactScore';
import { correctOutcomeRule } from '@/domain/scoring/rules/correctOutcome';
import { goalDifferenceRule } from '@/domain/scoring/rules/goalDifference';
import type { ScoringContext } from '@/domain/scoring/ScoringRule';

function ctx(
  prediction: [number, number],
  result: [number, number],
  overrides: Partial<ScoringContext> = {},
): ScoringContext {
  return {
    prediction: { homeGoals: prediction[0], awayGoals: prediction[1] },
    result: { homeGoals: result[0], awayGoals: result[1] },
    isHome: true,
    competitionType: 'LEAGUE',
    ...overrides,
  };
}

describe('bodovanje - v1 pravilo tocnog rezultata', () => {
  it('daje 1 bod za tocan rezultat, jer je to jedini nacin da se osvoji bod ove sezone', () => {
    const breakdown = scoreWithRuleIds(ctx([2, 1], [2, 1]), DEFAULT_RULE_IDS);

    expect(breakdown.total).toBe(1);
    expect(breakdown.hits).toHaveLength(1);
    expect(breakdown.hits[0]?.ruleId).toBe('exact-score');
  });

  it('daje 0 bodova kad je pogoden samo ishod, jer pogoden pobjednik ove sezone ne vrijedi nista', () => {
    const breakdown = scoreWithRuleIds(ctx([3, 1], [2, 0]), DEFAULT_RULE_IDS);

    expect(breakdown.total).toBe(0);
    expect(breakdown.hits).toHaveLength(0);
  });

  it('daje 0 bodova za potpuno promasenu prognozu', () => {
    expect(scoreWithRuleIds(ctx([0, 3], [2, 1]), DEFAULT_RULE_IDS).total).toBe(0);
  });

  it('razlikuje 2:1 od 1:2, jer je perspektiva utakmice a ne Hajduka', () => {
    expect(scoreWithRuleIds(ctx([2, 1], [1, 2]), DEFAULT_RULE_IDS).total).toBe(0);
  });

  it('cuva raspis bodova kako bi sucelje moglo objasniti odakle bod dolazi', () => {
    const breakdown = scoreWithRuleIds(ctx([0, 0], [0, 0]), DEFAULT_RULE_IDS);

    expect(breakdown.hits[0]).toEqual({
      ruleId: 'exact-score',
      label: 'Točan rezultat',
      points: 1,
    });
  });
});

describe('bodovanje - prosirivost', () => {
  it('ukljucivanje novog pravila mijenja ishod bez ijedne promjene u motoru', () => {
    const outcomeOnly = ctx([3, 1], [2, 0]);

    expect(score(outcomeOnly, [exactScoreRule]).total).toBe(0);
    expect(score(outcomeOnly, [exactScoreRule, correctOutcomeRule]).total).toBe(1);
  });

  it('pravila se ne preklapaju: tocan rezultat ne aktivira i pravilo ishoda', () => {
    const exact = ctx([2, 1], [2, 1]);
    const breakdown = score(exact, [exactScoreRule, correctOutcomeRule, goalDifferenceRule]);

    expect(breakdown.total).toBe(1);
    expect(breakdown.hits.map((h) => h.ruleId)).toEqual(['exact-score']);
  });

  it('gol-razlika se broji samo kad rezultat nije tocan', () => {
    // 3:1 prognoza, 2:0 stvarno - ista razlika, razlicit rezultat.
    expect(score(ctx([3, 1], [2, 0]), [goalDifferenceRule]).total).toBe(1);
    expect(score(ctx([2, 0], [2, 0]), [goalDifferenceRule]).total).toBe(0);
  });

  it('nepoznati id pravila se preskace umjesto da srusi obracun stare sezone', () => {
    const rules = resolveRules(['exact-score', 'pravilo-koje-vise-ne-postoji']);

    expect(rules).toHaveLength(1);
    expect(scoreWithRuleIds(ctx([1, 1], [1, 1]), ['exact-score', 'nepostojece']).total).toBe(1);
  });

  it('svako registrirano pravilo ima jedinstven id', () => {
    const ids = SCORING_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('obracun je ponovljiv, pa se utakmica moze presloziti bez promjene ishoda', () => {
    const c = ctx([1, 1], [1, 1]);
    expect(scoreWithRuleIds(c, DEFAULT_RULE_IDS)).toEqual(scoreWithRuleIds(c, DEFAULT_RULE_IDS));
  });
});
