'use server';

import { changeOwnPasswordSchema } from '@/application/dto/user';
import { changeOwnPassword } from '@/application/services/userService';
import { requireUser } from '@/infrastructure/auth/session';
import { actionOk, parseInput, withAction, type ActionResult } from '@/lib/action';

export async function changePasswordAction(
  _prev: ActionResult<{ done: true }> | null,
  formData: FormData,
): Promise<ActionResult<{ done: true }>> {
  return withAction('changePassword', async () => {
    const user = await requireUser();

    const input = parseInput(changeOwnPasswordSchema, {
      currentPassword: formData.get('currentPassword'),
      newPassword: formData.get('newPassword'),
      confirmPassword: formData.get('confirmPassword'),
    });

    await changeOwnPassword(user.id, input);

    return actionOk({ done: true as const });
  });
}
