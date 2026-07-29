import { z } from 'zod';
import type { LockReason } from '@/domain/match/lockPolicy';

export interface CompetitionDto {
  readonly id: string;
  readonly name: string;
  readonly shortName: string;
  readonly type: 'LEAGUE' | 'CUP' | 'EUROPE' | 'FRIENDLY';
}

export interface TeamDto {
  readonly id: string;
  readonly name: string;
  readonly shortName: string;
  readonly logoUrl: string | null;
}

export interface MatchResultDto {
  readonly homeGoals: number;
  readonly awayGoals: number;
  readonly source: 'API' | 'MANUAL';
  readonly correctedAt: string | null;
}

export interface MatchDto {
  readonly id: string;
  readonly opponent: TeamDto;
  readonly competition: CompetitionDto;
  readonly isHome: boolean;
  readonly kickoffAt: string;
  readonly round: string | null;
  readonly venue: string | null;
  readonly status: 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'POSTPONED' | 'CANCELLED';
  readonly syncState: 'NEEDS_CONFIRMATION' | 'CONFIRMED';
  readonly lockOverride: boolean | null;
  readonly isLocked: boolean;
  readonly lockReason: LockReason;
  readonly result: MatchResultDto | null;
  readonly scoredAt: string | null;
  /** Convenience for the UI: "HAJDUK - RIJEKA" ordering already resolved. */
  readonly homeName: string;
  readonly awayName: string;
}

export interface AdminMatchDto extends MatchDto {
  readonly apiFootballFixtureId: number | null;
  readonly manualOverrides: readonly string[];
  readonly resultPollAttempts: number;
  readonly predictionCount: number;
  readonly needsAttention: boolean;
}

const goals = z
  .number()
  .int('Broj golova mora biti cijeli broj')
  .min(0, 'Broj golova ne može biti negativan')
  .max(20, 'Broj golova ne može biti veći od 20');

export const createMatchSchema = z.object({
  opponentId: z.string().min(1, 'Odaberi protivnika'),
  competitionId: z.string().min(1, 'Odaberi natjecanje'),
  seasonId: z.string().min(1),
  isHome: z.boolean(),
  kickoffAt: z.coerce.date(),
  round: z.string().trim().max(64).optional(),
  venue: z.string().trim().max(120).optional(),
});

export const updateMatchSchema = createMatchSchema.extend({
  id: z.string().min(1),
});

export const confirmMatchSchema = z.object({ id: z.string().min(1) });

export const setLockSchema = z.object({
  id: z.string().min(1),
  /** null vraca automatsko zakljucavanje po vremenu pocetka. */
  lockOverride: z.boolean().nullable(),
});

export const setResultSchema = z.object({
  matchId: z.string().min(1),
  homeGoals: goals,
  awayGoals: goals,
  note: z.string().trim().max(280).optional(),
});

export const deleteMatchSchema = z.object({ id: z.string().min(1) });

export type CreateMatchInput = z.infer<typeof createMatchSchema>;
export type UpdateMatchInput = z.infer<typeof updateMatchSchema>;
export type SetLockInput = z.infer<typeof setLockSchema>;
export type SetResultInput = z.infer<typeof setResultSchema>;
