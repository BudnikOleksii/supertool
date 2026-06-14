'use client';

import type { FC, PropsWithChildren } from 'react';

import { useRouter } from '@supertool/next-shared/src/i18n/navigation/navigation';
import { TOOL_LIST } from '@supertool/shared/constants/tools';
import { AppShell } from '@supertool/shell/src/components/app-shell/AppShell';
import { authClient } from '@supertool/widgets/src/auth/auth-client';

import { ROUTES } from '../../constants/routes';

interface Props extends PropsWithChildren {
  userName?: string | undefined;
}

export const AppShellSection: FC<Props> = ({ userName, children }) => {
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await authClient.signOut();
    } finally {
      router.replace(ROUTES.signIn);
      router.refresh();
    }
  };

  return (
    <AppShell tools={TOOL_LIST} userName={userName} onSignOut={handleSignOut}>
      {children}
    </AppShell>
  );
};
