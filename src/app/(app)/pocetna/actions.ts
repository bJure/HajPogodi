'use server';

import { revalidatePath } from 'next/cache';
import { submitPredictionSchema } from '@/application/dto/prediction';
import type { PredictionDto } from '@/application/dto/prediction';
import { submitPrediction } from '@/application/services/predictionService';
import { requireUser } from '@/infrastructure/auth/session';
import { actionOk, parseInput, withAction, type ActionResult } from '@/lib/action';

export async function submitPredictionAction(
  _prev: ActionResult<PredictionDto> | null,
  formData: FormData,
): Promise<ActionResult<PredictionDto>> {
  return withAction('submitPrediction', async () => {
    const user = await requireUser();

    const input = parseInput(submitPredictionSchema, {
      matchId: formData.get('matchId'),
      homeGoals: Number(formData.get('homeGoals')),
      awayGoals: Number(formData.get('awayGoals')),
    });

    // The lock is enforced inside the service against the freshly loaded match,
    // never against anything this form sent.
    const prediction = await submitPrediction(user.id, input, new Date());

    revalidatePath('/pocetna');
    revalidatePath('/povijest');

    return actionOk(prediction);
  });
}
