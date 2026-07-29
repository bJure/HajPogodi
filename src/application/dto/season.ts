import { z } from 'zod';

export interface SeasonDto {
  readonly id: string;
  readonly name: string;
  readonly apiYear: number;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly isActive: boolean;
  readonly scoringRuleIds: readonly string[];
  readonly matchCount: number;
}

export const createSeasonSchema = z
  .object({
    name: z.string().trim().min(3, 'Naziv sezone mora imati barem 3 znaka').max(64),
    apiYear: z.coerce
      .number()
      .int()
      .min(2000, 'Godina mora biti barem 2000')
      .max(2100, 'Godina ne može biti veća od 2100'),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    scoringRuleIds: z.array(z.string().min(1)).min(1, 'Odaberi barem jedno pravilo bodovanja'),
  })
  .refine((data) => data.endsAt > data.startsAt, {
    message: 'Kraj sezone mora biti nakon početka',
    path: ['endsAt'],
  });

export const updateSeasonSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().trim().min(3).max(64),
    apiYear: z.coerce.number().int().min(2000).max(2100),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    scoringRuleIds: z.array(z.string().min(1)).min(1),
  })
  .refine((data) => data.endsAt > data.startsAt, {
    message: 'Kraj sezone mora biti nakon početka',
    path: ['endsAt'],
  });

export const activateSeasonSchema = z.object({ id: z.string().min(1) });

export type CreateSeasonInput = z.infer<typeof createSeasonSchema>;
export type UpdateSeasonInput = z.infer<typeof updateSeasonSchema>;
