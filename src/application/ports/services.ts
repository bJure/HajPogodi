/**
 * External service contracts.
 *
 * These are the seams the requirements explicitly asked for: the football data
 * source must be swappable ("official HNL site or another reliable API") and the
 * roast enrichment must degrade gracefully when no AI key is configured.
 */

export interface FixtureDto {
  readonly fixtureId: number;
  readonly kickoffAt: Date;
  readonly status: 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'POSTPONED' | 'CANCELLED';
  readonly round: string | null;
  readonly venue: string | null;
  readonly isHome: boolean;
  readonly opponent: {
    readonly apiTeamId: number;
    readonly name: string;
    readonly logoUrl: string | null;
  };
  readonly competition: {
    readonly apiLeagueId: number;
    readonly name: string;
    readonly type: 'LEAGUE' | 'CUP' | 'EUROPE' | 'FRIENDLY';
    readonly logoUrl: string | null;
  };
  /** Final score, present only once the fixture has finished. */
  readonly score: { readonly homeGoals: number; readonly awayGoals: number } | null;
  readonly raw: unknown;
}

export interface FootballApiPort {
  /** Every fixture for our club in one season, across all competitions. */
  listSeasonFixtures(seasonApiYear: number): Promise<FixtureDto[]>;
  /** One fixture, used by the result poller. */
  getFixture(fixtureId: number): Promise<FixtureDto | null>;
}

export interface RoastEnricherPort {
  /**
   * Rewrites a generated roast in a livelier voice. Implementations must never
   * throw: on any failure they return null and the deterministic text is used.
   */
  enrich(input: {
    readonly nickname: string;
    readonly tone: string;
    readonly baseText: string;
    readonly rank: number;
    readonly totalPlayers: number;
    readonly points: number;
    readonly gapToLeader: number;
    readonly accuracyPct: number;
    readonly scorelessStreak: number;
    readonly hitStreak: number;
  }): Promise<string | null>;
}

export interface PasswordHasherPort {
  hash(plain: string): Promise<string>;
  verify(plain: string, hash: string): Promise<boolean>;
}

export interface ClockPort {
  now(): Date;
}

export const systemClock: ClockPort = {
  now: () => new Date(),
};
