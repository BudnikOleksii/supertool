import '@supertool/ui/src/styles/index.scss';
import type { ReactNode } from 'react';

import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { routing } from '@supertool/next-shared/src/i18n/routing';
import { TOOL_LIST } from '@supertool/shared/constants/tools';
import { AppShell } from '@supertool/shell/src/components/app-shell/app-shell';

interface LocaleLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export const generateStaticParams = () => routing.locales.map((locale) => ({ locale }));

const LocaleLayout = async ({ children, params }: LocaleLayoutProps) => {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider>
          <AppShell tools={TOOL_LIST}>{children}</AppShell>
        </NextIntlClientProvider>
      </body>
    </html>
  );
};

export default LocaleLayout;
