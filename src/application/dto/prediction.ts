import { z } from 'zod';
import type { RuleHit } from '@/domain/scoring/ScoringRule';
import type { MatchDto } from './match';

export interface PredictionDto {
  readonly id: string;
  readonly matchId: string;
  readonly userId: string;
  readonly nickname: string;
  readonly homeGoals: number;
  readonly awayGoals: number;
  readonly submittedAt: string;
  readonly editCount: number;
  readonly points: number | null;
  readonly breakdown: readonly RuleHit[];
  readonly exact: boolean;
}

/** One row in the "my predictions" list: the match plus my pick. */
export interface PredictionWithMatchDto {
  readonly match: MatchDto;
  readonly prediction: PredictionDto | null;
}

const goals = z
  .number({ error: 'Unesi broj golova' })
  .int('Broj golova mora biti cijeli broj')
  .min(0, 'Broj golova ne može biti negativan')
  .max(20, 'Broj golova ne može biti veći od 20');

export const submitPredictionSchema = z.object({
  matchId: z.string().min(1),
  homeGoals: goals,
  awayGoals: goals,
});

export type SubmitPredictionInput = z.infer<typeof submitPredictionSchema>;
