import { z } from 'zod';

import { NAME_MIN_LENGTH } from '@supertool/shared/constants/validation';

export const MIN_PASSWORD_LENGTH = 8;

export const signInFormSchema = z.object({
  email: z.email('emailInvalid'),
  password: z.string('passwordRequired').min(MIN_PASSWORD_LENGTH, 'passwordMinLength'),
});

export type SignInFormValues = z.infer<typeof signInFormSchema>;

export const signUpFormSchema = z.object({
  firstName: z.string('firstNameRequired').trim().min(NAME_MIN_LENGTH, 'firstNameRequired'),
  lastName: z.string().trim().optional(),
  email: z.email('emailInvalid'),
  password: z.string('passwordRequired').min(MIN_PASSWORD_LENGTH, 'passwordMinLength'),
});

export type SignUpFormValues = z.infer<typeof signUpFormSchema>;
