import { z } from 'zod';

export const MIN_PASSWORD_LENGTH = 8;
const MIN_NAME_LENGTH = 1;

export const signInFormSchema = z.object({
  email: z.email('emailInvalid'),
  password: z.string('passwordRequired').min(MIN_PASSWORD_LENGTH, 'passwordMinLength'),
});

export type SignInFormValues = z.infer<typeof signInFormSchema>;

export const signUpFormSchema = z.object({
  name: z.string('nameRequired').trim().min(MIN_NAME_LENGTH, 'nameRequired'),
  email: z.email('emailInvalid'),
  password: z.string('passwordRequired').min(MIN_PASSWORD_LENGTH, 'passwordMinLength'),
});

export type SignUpFormValues = z.infer<typeof signUpFormSchema>;
