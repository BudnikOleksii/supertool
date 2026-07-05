import { z } from 'zod';

import { NAME_MIN_LENGTH } from '@supertool/shared/constants/validation';

export const MIN_PASSWORD_LENGTH = 8;

export const passwordFieldSchema = z
  .string('passwordRequired')
  .min(MIN_PASSWORD_LENGTH, 'passwordMinLength');

export const signInFormSchema = z.object({
  email: z.email('emailInvalid'),
  password: passwordFieldSchema,
});

export type SignInFormValues = z.infer<typeof signInFormSchema>;

export const signUpFormSchema = z.object({
  firstName: z.string('firstNameRequired').trim().min(NAME_MIN_LENGTH, 'firstNameRequired'),
  lastName: z.string().trim().optional(),
  email: z.email('emailInvalid'),
  password: passwordFieldSchema,
});

export type SignUpFormValues = z.infer<typeof signUpFormSchema>;

export const changePasswordFormSchema = z
  .object({
    currentPassword: passwordFieldSchema,
    newPassword: passwordFieldSchema,
    confirmPassword: z.string('passwordRequired'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'passwordsMismatch',
  });

export type ChangePasswordFormValues = z.infer<typeof changePasswordFormSchema>;
