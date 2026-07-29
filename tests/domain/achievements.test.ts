import { describe, expect, it } from 'vitest';
import { evaluateAchievements } from '@/domain/achievement/AchievementEvaluator';
import { ACHIEVEMENTS, type AchievementContext, type AchievementMatch } from '@/domain/achievement/definitions';

function match(overrides: Partial<AchievementMatch> & { day: number }): AchievementMatch {
  const { day, ...rest } = overrides;
  return {
    matchId: `m${day}`,
    kickoffAt: new Date(Date.UTC(2026, 8, day)),
    opponent: 'Rijeka',
    competitionType: 'LEAGUE',
    isHome: true,
    predicted: true,
    points: 0,
    exact: false,
    exactPredictorCount: 0,
    goalsFor: 1,
    goalsAgainst: 1,
    ...rest,
  };
}

function ctx(history: AchievementMatch[], overrides: Partial<AchievementContext> = {}): AchievementContext {
  return { history, rank: 5, totalPlayers: 10, ...overrides };
}

const exact = (day: number, extra: Partial<AchievementMatch> = {}) =>
  match({ day, exact: true, points: 1, exactPredictorCount: 2, ...extra });

describe('postignuca', () => {
  it('otkljucava Coravu kokos na prvom pogodenom rezultatu', () => {
    const unlocked = evaluateAchievements(ctx([exact(1)]), []);
    expect(unlocked.map((a) => a.code)).toContain('corava-kokos');
  });

  it('ne otkljucava Coravu kokos bez ijednog pogotka', () => {
    const unlocked = evaluateAchievements(ctx([match({ day: 1 })]), []);
    expect(unlocked.map((a) => a.code)).not.toContain('corava-kokos');
  });

  it('Prorok Poljuda trazi pet pogodaka zaredom, ne pet ukupno', () => {
    const scattered = [exact(1), match({ day: 2 }), exact(3), exact(4), exact(5), exact(6)];
    expect(evaluateAchievements(ctx(scattered), []).map((a) => a.code)).not.toContain(
      'prorok-poljuda',
    );

    const consecutive = [exact(1), exact(2), exact(3), exact(4), exact(5)];
    expect(evaluateAchievements(ctx(consecutive), []).map((a) => a.code)).toContain(
      'prorok-poljuda',
    );
  });

  it('Kralj derbija se otkljucava samo protiv Dinama', () => {
    const vsRijeka = evaluateAchievements(ctx([exact(1, { opponent: 'Rijeka' })]), []);
    expect(vsRijeka.map((a) => a.code)).not.toContain('kralj-derbija');

    const vsDinamo = evaluateAchievements(ctx([exact(1, { opponent: 'Dinamo Zagreb' })]), []);
    expect(vsDinamo.map((a) => a.code)).toContain('kralj-derbija');
  });

  it('Kralj derbija se ne otkljucava za promasenu prognozu protiv Dinama', () => {
    const missed = evaluateAchievements(ctx([match({ day: 1, opponent: 'Dinamo Zagreb' })]), []);
    expect(missed.map((a) => a.code)).not.toContain('kralj-derbija');
  });

  it('Usamljeni vuk trazi da si jedini pogodio', () => {
    const shared = evaluateAchievements(ctx([exact(1, { exactPredictorCount: 3 })]), []);
    expect(shared.map((a) => a.code)).not.toContain('usamljeni-vuk');

    const alone = evaluateAchievements(ctx([exact(1, { exactPredictorCount: 1 })]), []);
    expect(alone.map((a) => a.code)).toContain('usamljeni-vuk');
  });

  it('ne otkljucava dvaput, jer se ponovni obracun bodova pokrece i nakon ispravka rezultata', () => {
    const history = [exact(1)];
    const first = evaluateAchievements(ctx(history), []);
    const codes = first.map((a) => a.code);

    const second = evaluateAchievements(ctx(history), codes);
    expect(second).toHaveLength(0);
  });

  it('svako postignuce ima jedinstven kod', () => {
    const codes = ACHIEVEMENTS.map((a) => a.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('prvo mjesto otkljucava Na vrhu, ali ne u igri od jednog igraca', () => {
    expect(
      evaluateAchievements(ctx([exact(1)], { rank: 1, totalPlayers: 4 }), []).map((a) => a.code),
    ).toContain('na-vrhu');

    expect(
      evaluateAchievements(ctx([exact(1)], { rank: 1, totalPlayers: 1 }), []).map((a) => a.code),
    ).not.toContain('na-vrhu');
  });

  it('Zid od Poljuda trazi utakmicu bez primljenog gola', () => {
    const clean = evaluateAchievements(ctx([exact(1, { goalsAgainst: 0 })]), []);
    expect(clean.map((a) => a.code)).toContain('zid-od-poljuda');
  });

  it('Gost na terenu trazi tri pogotka u gostima', () => {
    const two = [exact(1, { isHome: false }), exact(2, { isHome: false })];
    expect(evaluateAchievements(ctx(two), []).map((a) => a.code)).not.toContain('gost-na-teren');

    const three = [...two, exact(3, { isHome: false })];
    expect(evaluateAchievements(ctx(three), []).map((a) => a.code)).toContain('gost-na-teren');
  });
});
