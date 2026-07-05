import { z } from 'zod';

export const createDeleteAccountFormSchema = (email: string) =>
  z.object({
    confirmation: z.string().refine((value) => value === email, 'emailMismatch'),
  });

export type DeleteAccountFormValues = z.infer<ReturnType<typeof createDeleteAccountFormSchema>>;
