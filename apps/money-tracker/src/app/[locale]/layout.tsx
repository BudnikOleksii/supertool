// oxlint-disable new-cap
import type { FC, PropsWithChildren } from 'react';

import { NextIntlClientProvider } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { ThemeProvider } from 'next-themes';
import { Poppins } from 'next/font/google';

import { routing } from '@supertool/next-shared/src/i18n/routing';
import '@supertool/ui/src/styles/index.scss';

import { fetchProfile } from '../../actions/fetch-profile';
import { AppShellSection } from './AppShellSection';

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

  const profile = await fetchProfile();

  return (
    <html lang={params.locale} suppressHydrationWarning>
      <body className={poppins.variable}>
        <NextIntlClientProvider>
          <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem>
            <AppShellSection userName={profile?.name}>{children}</AppShellSection>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
};

export default LocaleLayout;
