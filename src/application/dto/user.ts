import { z } from 'zod';

/**
 * User DTOs. Note there is no `passwordHash` field anywhere in this file - the
 * type system, not discipline, is what keeps hashes out of responses.
 */
export interface UserDto {
  readonly id: string;
  readonly username: string;
  readonly nickname: string;
  readonly role: 'ADMIN' | 'USER';
  readonly isActive: boolean;
  readonly mustChangePassword: boolean;
  readonly lastLoginAt: string | null;
  readonly createdAt: string;
}

export interface UserSummaryDto {
  readonly id: string;
  readonly nickname: string;
}

const username = z
  .string()
  .trim()
  .min(3, 'Korisničko ime mora imati barem 3 znaka')
  .max(32, 'Korisničko ime može imati najviše 32 znaka')
  .regex(/^[a-zA-Z0-9._-]+$/, 'Dozvoljena su slova, brojke, točka, crtica i podvlaka');

/**
 * One rule for every path that sets a password: admin creating an account,
 * admin resetting one, user changing their own. The seed already demanded 12
 * for the first admin, and an account whose password an admin picked is no less
 * worth protecting than that one.
 */
const password = z
  .string()
  .min(12, 'Lozinka mora imati barem 12 znakova')
  .max(128, 'Lozinka može imati najviše 128 znakova');

const nickname = z
  .string()
  .trim()
  .min(2, 'Nadimak mora imati barem 2 znaka')
  .max(24, 'Nadimak može imati najviše 24 znaka');

export const createUserSchema = z.object({
  username,
  password,
  nickname,
  role: z.enum(['ADMIN', 'USER']).default('USER'),
});

export const updateUserSchema = z.object({
  id: z.string().min(1),
  nickname,
  role: z.enum(['ADMIN', 'USER']),
});

export const resetPasswordSchema = z.object({
  id: z.string().min(1),
  newPassword: password,
});

export const changeOwnPasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Unesi trenutnu lozinku'),
    newPassword: password,
    confirmPassword: z.string().min(1),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Lozinke se ne podudaraju',
    path: ['confirmPassword'],
  });

export const toggleActiveSchema = z.object({
  id: z.string().min(1),
  isActive: z.boolean(),
});

export const deleteUserSchema = z.object({ id: z.string().min(1) });

export const loginSchema = z.object({
  username: z.string().trim().min(1, 'Unesi korisničko ime'),
  password: z.string().min(1, 'Unesi lozinku'),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangeOwnPasswordInput = z.infer<typeof changeOwnPasswordSchema>;
export type ToggleActiveInput = z.infer<typeof toggleActiveSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
