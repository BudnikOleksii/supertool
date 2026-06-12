// oxlint-disable new-cap
import type { FC, PropsWithChildren } from 'react';

import { NextIntlClientProvider } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { ThemeProvider } from 'next-themes';
import { Poppins } from 'next/font/google';

import { routing } from '@supertool/next-shared/src/i18n/routing';
import { TOOL_LIST } from '@supertool/shared/constants/tools';
import { AppShell } from '@supertool/shell/src/components/app-shell/AppShell';
import '@supertool/ui/src/styles/index.scss';

const poppins = Poppins({
  subsets: ['latin'],
  variable: '--default-font-family',
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});

interface Props extends PropsWithChildren {
  params: Promise<{ locale: string }>;
}

export const generateStaticParams = () => routing.locales.map((locale) => ({ locale }));

const LocaleLayout: FC<Props> = async (props) => {
  const params = await props.params;
  const { children } = props;

  setRequestLocale(params.locale);

  return (
    <html lang={params.locale} suppressHydrationWarning>
      <body className={poppins.variable}>
        <NextIntlClientProvider>
          <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem>
            <AppShell tools={TOOL_LIST}>{children}</AppShell>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
};

export default LocaleLayout;
