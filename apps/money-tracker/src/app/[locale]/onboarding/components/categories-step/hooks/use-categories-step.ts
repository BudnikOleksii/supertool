import { useCallback, useState, useTransition } from 'react';

import { useRouter } from '@supertool/next-shared/src/i18n/navigation/navigation';
import { UNKNOWN_ERROR_CODE } from '@supertool/next-shared/src/types/action-state';
import type { ErrorCode } from '@supertool/shared/constants/error-codes';
import type { DefaultCategoriesResponseDto } from '@supertool/shared/generated/types.gen';

import { assignDefaultCategories } from '../../../../../../actions/assign-default-categories';
import { completeOnboarding } from '../../../../../../actions/complete-onboarding';
import { ROUTES } from '../../../../../../constants/routes';
import { useImportFlow } from '../../../../../../hooks/use-import-flow';

type OnboardingErrorCode = ErrorCode | typeof UNKNOWN_ERROR_CODE;

interface UnknownErrorState {
  status: 'error';
  code: OnboardingErrorCode;
}

const buildUnknownError = (): UnknownErrorState => ({ status: 'error', code: UNKNOWN_ERROR_CODE });

export const useCategoriesStep = () => {
  const router = useRouter();
  const importFlow = useImportFlow();
  const [isActionPending, startTransition] = useTransition();
  const [defaultsResult, setDefaultsResult] = useState<DefaultCategoriesResponseDto | null>(null);
  const [errorCode, setErrorCode] = useState<OnboardingErrorCode | null>(null);

  const handleAssignDefaults = useCallback(() => {
    startTransition(async () => {
      setErrorCode(null);

      const result = await assignDefaultCategories().catch(buildUnknownError);

      if (result.status === 'error') {
        setErrorCode(result.code);

        return;
      }

      setDefaultsResult(result.result);
    });
  }, []);

  const handleComplete = useCallback(() => {
    startTransition(async () => {
      setErrorCode(null);

      const result = await completeOnboarding().catch(buildUnknownError);

      if (result.status === 'error') {
        setErrorCode(result.code);

        return;
      }

      router.replace(ROUTES.dashboard);
    });
  }, [router]);

  return {
    importFlow,
    isPending: isActionPending || importFlow.isPending,
    defaultsResult,
    errorCode,
    hasCategoriesReady: defaultsResult !== null || importFlow.report !== null,
    handleAssignDefaults,
    handleComplete,
  };
};
