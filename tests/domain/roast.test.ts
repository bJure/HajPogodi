import { describe, expect, it } from 'vitest';
import { generateRoast, messageSpaceSize } from '@/domain/roast/RoastEngine';
import { extractSignals, type RoastContext } from '@/domain/roast/signals';
import { MIN_VARIANTS_PER_SLOT, TEMPLATES } from '@/domain/roast/templates';
import { pickTone, TONES, type Tone } from '@/domain/roast/tone';
import { bodovi, pluralHr } from '@/domain/roast/croatian';

const NOW = new Date('2026-09-01T08:00:00Z');

function context(overrides: Partial<RoastContext> = {}): RoastContext {
  return {
    nickname: 'Jure',
    rank: 5,
    totalPlayers: 10,
    points: 4,
    gapToLeader: 3,
    // Namjerno 2: gapToNext = 1 znaci "dise ti za vratom" i aktivira ton CHASER.
    gapToNext: 2,
    lastThree: [0, 1, 0],
    accuracyPct: 33,
    scorelessStreak: 1,
    hitStreak: 0,
    matchesPlayed: 12,
    rankDelta: 0,
    ...overrides,
  };
}

const OPTIONS = { userId: 'u1', seasonId: 's1', now: NOW };

describe('roast - odabir tona', () => {
  it('novajlija ima prednost nad svime, jer ga nema smisla ocjenjivati nakon dvije utakmice', () => {
    const ctx = context({ matchesPlayed: 1, rank: 10, totalPlayers: 10, scorelessStreak: 9 });
    expect(pickTone(extractSignals(ctx))).toBe('ROOKIE');
  });

  it('prvi na ljestvici dobiva ton kralja', () => {
    expect(pickTone(extractSignals(context({ rank: 1 })))).toBe('KING');
  });

  it('dugi niz bez boda vodi u podrum, cak i ako nije zadnji', () => {
    const ctx = context({ rank: 4, scorelessStreak: 7 });
    expect(pickTone(extractSignals(ctx))).toBe('BASEMENT');
  });

  it('niz pogodaka vodi u ton naleta', () => {
    expect(pickTone(extractSignals(context({ hitStreak: 3 })))).toBe('HOT');
  });

  it('sredina ljestvice bez izrazene forme dobiva ton prosjeka', () => {
    const ctx = context({ rank: 5, totalPlayers: 10, lastThree: [1, 0, 0], scorelessStreak: 1 });
    expect(pickTone(extractSignals(ctx))).toBe('MEDIOCRE');
  });

  it('zadnje mjesto dobiva ton podruma', () => {
    const ctx = context({ rank: 10, totalPlayers: 10, lastThree: [0, 0, 0], scorelessStreak: 4 });
    expect(pickTone(extractSignals(ctx))).toBe('BASEMENT');
  });

  it('svaki definirani ton je dosezljiv iz nekog stvarnog stanja', () => {
    const reachable = new Set<Tone>([
      pickTone(extractSignals(context({ matchesPlayed: 1 }))),
      pickTone(extractSignals(context({ rank: 1 }))),
      pickTone(extractSignals(context({ rank: 2, totalPlayers: 10, lastThree: [1, 1, 0] }))),
      pickTone(extractSignals(context({ hitStreak: 3 }))),
      pickTone(extractSignals(context({ scorelessStreak: 4, lastThree: [0, 0, 0] }))),
      pickTone(extractSignals(context({ rank: 10, totalPlayers: 10, scorelessStreak: 8 }))),
      pickTone(extractSignals(context())),
      pickTone(
        extractSignals(context({ rank: 6, totalPlayers: 12, rankDelta: 2, lastThree: [1, 0, 0] })),
      ),
    ]);

    for (const tone of TONES) {
      expect(reachable.has(tone), `ton ${tone} nije dosezljiv`).toBe(true);
    }
  });
});

describe('roast - generiranje poruke', () => {
  it('vraca istu poruku za isti dan, kako se ne bi mijenjala izmedu servera i klijenta', () => {
    const ctx = context();
    expect(generateRoast(ctx, OPTIONS).text).toBe(generateRoast(ctx, OPTIONS).text);
  });

  it('mijenja poruku sljedeci dan, jer se ista sala ne prica dvaput', () => {
    const ctx = context();
    const today = generateRoast(ctx, OPTIONS).text;
    const tomorrow = generateRoast(ctx, { ...OPTIONS, now: new Date('2026-09-02T08:00:00Z') }).text;

    expect(today).not.toBe(tomorrow);
  });

  it('daje razlicitim korisnicima razlicite poruke istog dana', () => {
    const ctx = context();
    const a = generateRoast(ctx, OPTIONS).text;
    const b = generateRoast(ctx, { ...OPTIONS, userId: 'u2' }).text;

    expect(a).not.toBe(b);
  });

  it('nikad ne ostavlja nezamijenjen placeholder u tekstu', () => {
    for (const tone of TONES) {
      // Prisili svaki ton kroz stanje koje ga aktivira.
      const ctxByTone: Record<Tone, RoastContext> = {
        ROOKIE: context({ matchesPlayed: 1 }),
        KING: context({ rank: 1 }),
        CHASER: context({ rank: 2, totalPlayers: 10, lastThree: [1, 1, 0] }),
        HOT: context({ hitStreak: 3 }),
        SLUMP: context({ scorelessStreak: 4, lastThree: [0, 0, 0] }),
        BASEMENT: context({ rank: 10, totalPlayers: 10, scorelessStreak: 8 }),
        MEDIOCRE: context(),
        CLIMBER: context({ rank: 6, totalPlayers: 12, rankDelta: 2, lastThree: [1, 0, 0] }),
      };

      for (let day = 1; day <= 28; day++) {
        const now = new Date(`2026-09-${String(day).padStart(2, '0')}T08:00:00Z`);
        const roast = generateRoast(ctxByTone[tone], { ...OPTIONS, now });

        expect(roast.text, `${tone} dan ${day}`).not.toMatch(/\{\w+\}/);
        expect(roast.text.length).toBeGreaterThan(20);
      }
    }
  });

  it('proizvodi bar 300 razlicitih poruka, kako je i trazeno', () => {
    const seen = new Set<string>();

    for (let day = 0; day < 400; day++) {
      const now = new Date(Date.UTC(2026, 8, 1) + day * 86_400_000);
      seen.add(generateRoast(context(), { ...OPTIONS, now }).text);
    }

    expect(seen.size).toBeGreaterThanOrEqual(300);
  });

  it('teoretski prostor poruka je red velicine sto tisuca kombinacija', () => {
    expect(messageSpaceSize()).toBeGreaterThan(100_000);
  });

  it('svaki ton nudi dovoljno varijanti po svakom dijelu recenice', () => {
    for (const tone of TONES) {
      const bank = TEMPLATES[tone];
      for (const slot of ['opener', 'jab', 'twist', 'closer'] as const) {
        expect(bank[slot].length, `${tone}.${slot}`).toBeGreaterThanOrEqual(MIN_VARIANTS_PER_SLOT);
      }
    }
  });

  it('hash konteksta se mijenja kad se stanje promijeni, jer je to kljuc predmemorije', () => {
    const base = generateRoast(context(), OPTIONS).contextHash;
    const moved = generateRoast(context({ rank: 1, points: 9 }), OPTIONS).contextHash;

    expect(base).not.toBe(moved);
  });
});

describe('hrvatska mnozina', () => {
  it('koristi tri oblika, ukljucujuci iznimku za 11-14', () => {
    expect(bodovi(1)).toBe('1 bod');
    expect(bodovi(3)).toBe('3 boda');
    expect(bodovi(5)).toBe('5 bodova');
    expect(bodovi(11)).toBe('11 bodova');
    expect(bodovi(21)).toBe('21 bod');
    expect(bodovi(22)).toBe('22 boda');
    expect(bodovi(0)).toBe('0 bodova');
    expect(pluralHr(114, 'a', 'b', 'c')).toBe('c');
  });
});
