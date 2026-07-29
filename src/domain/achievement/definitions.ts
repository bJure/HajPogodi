/**
 * Achievement catalogue.
 *
 * Each definition is a pure predicate over a user's season history, so the
 * evaluator never needs to know what any individual achievement means. Adding a
 * new one is a single entry here plus a seed row.
 */

export type AchievementTier = 'BRONCA' | 'SREBRO' | 'ZLATO' | 'LEGENDA';

export interface AchievementMatch {
  readonly matchId: string;
  readonly kickoffAt: Date;
  readonly opponent: string;
  readonly competitionType: 'LEAGUE' | 'CUP' | 'EUROPE' | 'FRIENDLY';
  readonly isHome: boolean;
  readonly predicted: boolean;
  readonly points: number;
  readonly exact: boolean;
  /** Number of players who nailed the exact score in this match. */
  readonly exactPredictorCount: number;
  readonly goalsFor: number;
  readonly goalsAgainst: number;
}

export interface AchievementContext {
  /** Whole season history for one user, oldest first. */
  readonly history: readonly AchievementMatch[];
  readonly rank: number;
  readonly totalPlayers: number;
}

export interface AchievementDefinition {
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly icon: string;
  readonly tier: AchievementTier;
  readonly sortOrder: number;
  /** True once the user has earned it. Must be monotonic: never un-earn. */
  isUnlocked(ctx: AchievementContext): boolean;
}

/** Opponents that count as a derby for achievement purposes. */
const DERBY_OPPONENTS = ['Dinamo Zagreb', 'Dinamo', 'GNK Dinamo Zagreb'];

function isDerby(opponent: string): boolean {
  return DERBY_OPPONENTS.some((name) => opponent.toLowerCase().includes(name.toLowerCase()));
}

function longestExactRun(history: readonly AchievementMatch[]): number {
  let best = 0;
  let run = 0;
  for (const match of history) {
    if (match.exact) {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }
  return best;
}

function exactCount(history: readonly AchievementMatch[]): number {
  return history.filter((m) => m.exact).length;
}

export const ACHIEVEMENTS: readonly AchievementDefinition[] = [
  {
    code: 'corava-kokos',
    name: 'Ćorava kokoš',
    description: 'Prvi pogođeni točan rezultat. I slijepa kokoš nađe zrno.',
    icon: '🐔',
    tier: 'BRONCA',
    sortOrder: 10,
    isUnlocked: (ctx) => exactCount(ctx.history) >= 1,
  },
  {
    code: 'prorok-poljuda',
    name: 'Prorok Poljuda',
    description: 'Pet pogođenih rezultata zaredom.',
    icon: '🔮',
    tier: 'LEGENDA',
    sortOrder: 90,
    isUnlocked: (ctx) => longestExactRun(ctx.history) >= 5,
  },
  {
    code: 'kralj-derbija',
    name: 'Kralj derbija',
    description: 'Pogođen točan rezultat protiv Dinama.',
    icon: '👑',
    tier: 'ZLATO',
    sortOrder: 70,
    isUnlocked: (ctx) => ctx.history.some((m) => m.exact && isDerby(m.opponent)),
  },
  {
    code: 'europska-noc',
    name: 'Europska noć',
    description: 'Pogođen točan rezultat u europskom natjecanju.',
    icon: '🌍',
    tier: 'SREBRO',
    sortOrder: 50,
    isUnlocked: (ctx) => ctx.history.some((m) => m.exact && m.competitionType === 'EUROPE'),
  },
  {
    code: 'usamljeni-vuk',
    name: 'Usamljeni vuk',
    description: 'Jedini si pogodio rezultat u jednom kolu.',
    icon: '🐺',
    tier: 'ZLATO',
    sortOrder: 60,
    isUnlocked: (ctx) => ctx.history.some((m) => m.exact && m.exactPredictorCount === 1),
  },
  {
    code: 'dvostruki-udarac',
    name: 'Dvostruki udarac',
    description: 'Dva pogođena rezultata zaredom.',
    icon: '⚡',
    tier: 'SREBRO',
    sortOrder: 30,
    isUnlocked: (ctx) => longestExactRun(ctx.history) >= 2,
  },
  {
    code: 'vjerni-navijac',
    name: 'Vjerni navijač',
    description: 'Prognozirao si deset utakmica u sezoni.',
    icon: '🎽',
    tier: 'BRONCA',
    sortOrder: 20,
    isUnlocked: (ctx) => ctx.history.filter((m) => m.predicted).length >= 10,
  },
  {
    code: 'bez-preskakanja',
    name: 'Nijedno kolo bez mene',
    description: 'Prognozirao si svih prvih petnaest utakmica sezone.',
    icon: '📅',
    tier: 'ZLATO',
    sortOrder: 65,
    isUnlocked: (ctx) => {
      const first15 = ctx.history.slice(0, 15);
      return first15.length >= 15 && first15.every((m) => m.predicted);
    },
  },
  {
    code: 'gol-mašina',
    name: 'Gol mašina',
    description: 'Pogodio si rezultat u utakmici s barem pet golova.',
    icon: '💥',
    tier: 'SREBRO',
    sortOrder: 45,
    isUnlocked: (ctx) =>
      ctx.history.some((m) => m.exact && m.goalsFor + m.goalsAgainst >= 5),
  },
  {
    code: 'zid-od-poljuda',
    name: 'Zid od Poljuda',
    description: 'Pogodio si rezultat utakmice u kojoj Hajduk nije primio gol.',
    icon: '🧱',
    tier: 'SREBRO',
    sortOrder: 40,
    isUnlocked: (ctx) => ctx.history.some((m) => m.exact && m.goalsAgainst === 0),
  },
  {
    code: 'gost-na-teren',
    name: 'Gost na terenu',
    description: 'Pogodio si tri rezultata u gostima.',
    icon: '✈️',
    tier: 'ZLATO',
    sortOrder: 55,
    isUnlocked: (ctx) => ctx.history.filter((m) => m.exact && !m.isHome).length >= 3,
  },
  {
    code: 'na-vrhu',
    name: 'Na vrhu',
    description: 'Bio si prvi na ljestvici.',
    icon: '🏆',
    tier: 'LEGENDA',
    sortOrder: 95,
    isUnlocked: (ctx) => ctx.rank === 1 && ctx.totalPlayers > 1,
  },
  {
    code: 'desetka',
    name: 'Desetka',
    description: 'Skupio si deset bodova u sezoni.',
    icon: '🔟',
    tier: 'ZLATO',
    sortOrder: 75,
    isUnlocked: (ctx) => ctx.history.reduce((sum, m) => sum + m.points, 0) >= 10,
  },
  {
    code: 'kup-specijalist',
    name: 'Kup specijalist',
    description: 'Pogodio si rezultat kup utakmice.',
    icon: '🏅',
    tier: 'SREBRO',
    sortOrder: 35,
    isUnlocked: (ctx) => ctx.history.some((m) => m.exact && m.competitionType === 'CUP'),
  },
];

export function getAchievement(code: string): AchievementDefinition | undefined {
  return ACHIEVEMENTS.find((a) => a.code === code);
}
