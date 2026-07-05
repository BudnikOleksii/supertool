import { zodResolver } from '@hookform/resolvers/zod';
import { unstable_rethrow } from 'next/navigation';
import { useCallback, useMemo, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';

import type { DeleteAccountFormValues } from '../../../constants/delete-account-form-schema';

import { deleteAccount } from '../../../../../../actions/delete-account';
import { createDeleteAccountFormSchema } from '../../../constants/delete-account-form-schema';

export const DELETE_ACCOUNT_FAILED_CODE = 'deleteAccountFailed';

interface UseDeleteAccountParams {
  email: string;
}

export const useDeleteAccount = ({ email }: UseDeleteAccountParams) => {
  const [isOpen, setIsOpen] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const schema = useMemo(() => createDeleteAccountFormSchema(email), [email]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<DeleteAccountFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { confirmation: '' },
    mode: 'onChange',
  });

  const confirmation = watch('confirmation');
  const isMatch = confirmation === email;

  const handleConfirm = useCallback((): void => {
    setErrorCode(null);
    startTransition(async () => {
      try {
        const result = await deleteAccount();

        if (result.status === 'error') {
          setErrorCode(result.code);
        }
      } catch (error) {
        unstable_rethrow(error);
        setErrorCode(DELETE_ACCOUNT_FAILED_CODE);
      }
    });
  }, []);

  const handleOpenChange = useCallback(
    (open: boolean): void => {
      setIsOpen(open);

      if (!open) {
        reset();
        setErrorCode(null);
      }
    },
    [reset],
  );

  return {
    isOpen,
    errorCode,
    isPending,
    isMatch,
    hasConfirmationValue: confirmation !== '',
    register,
    handleSubmit,
    errors,
    handleConfirm,
    handleOpenChange,
  };
};
