'use client';

import type { FC, PropsWithChildren } from 'react';

import {
  ArrowLeftRight,
  CalendarDays,
  Import,
  LayoutDashboard,
  LayoutList,
  Repeat,
  Settings,
  Tags,
} from 'lucide-react';

import { useRouter } from '@supertool/next-shared/src/i18n/navigation/navigation';
import type { LocaleCode } from '@supertool/shared/constants/locales';
import { TOOL_LIST } from '@supertool/shared/constants/tools';
import { AppShell } from '@supertool/shell/src/components/app-shell/AppShell';
import type { NavItem } from '@supertool/shell/src/components/app-shell/types';
import { authClient } from '@supertool/widgets/src/auth/auth-client';

import { updateLocale } from '../../actions/update-locale';
import { ROUTES } from '../../constants/routes';

const NAV_ITEM_LIST: NavItem[] = [
  { href: ROUTES.dashboard, labelKey: 'dashboard', Icon: LayoutDashboard },
  {
    href: ROUTES.transactions,
    labelKey: 'transactions',
    Icon: ArrowLeftRight,
    children: [
      { href: ROUTES.transactions, labelKey: 'transactionsByDate', Icon: CalendarDays },
      {
        href: ROUTES.transactionsByCategory,
        labelKey: 'transactionsByCategory',
        Icon: LayoutList,
      },
      {
        href: ROUTES.transactionsRecurring,
        labelKey: 'recurringTransactions',
        Icon: Repeat,
        disabled: true,
      },
      {
        href: ROUTES.transactionsImport,
        labelKey: 'transactionsImport',
        Icon: Import,
      },
    ],
  },
  { href: ROUTES.categories, labelKey: 'categories', Icon: Tags },
  { href: ROUTES.settings, labelKey: 'settings', Icon: Settings },
];

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

    await updateLocale(locale);
  };

  return (
    <AppShell
      tools={TOOL_LIST}
      navItems={NAV_ITEM_LIST}
      userName={userName}
      onLocaleChange={handleLocaleChange}
      onOpenSettings={handleOpenSettings}
      onSignOut={handleSignOut}
    >
      {children}
    </AppShell>
  );
};
