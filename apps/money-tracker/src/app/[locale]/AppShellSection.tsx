'use client';

import type { FC, PropsWithChildren } from 'react';

import { useRouter } from '@supertool/next-shared/src/i18n/navigation/navigation';
import type { LocaleCode } from '@supertool/shared/constants/locales';
import { TOOL_LIST } from '@supertool/shared/constants/tools';
import { AppShell } from '@supertool/shell/src/components/app-shell/AppShell';
import { authClient } from '@supertool/widgets/src/auth/auth-client';

import { updateProfile } from '../../actions/update-profile';
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

  const handleOpenSettings = () => {
    router.push(ROUTES.settings);
  };

  const handleLocaleChange = async (locale: LocaleCode) => {
    if (userName === undefined) {
      return;
    }

    await updateProfile({ name: userName, locale });
  };

  return (
    <AppShell
      tools={TOOL_LIST}
      userName={userName}
      onLocaleChange={handleLocaleChange}
      onOpenSettings={handleOpenSettings}
      onSignOut={handleSignOut}
    >
      {children}
    </AppShell>
  );
};
