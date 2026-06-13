import type { FC } from 'react';

import { useTranslations } from 'next-intl';

import { Button } from '@supertool/ui/src/components/atoms/button/Button';

export const UserMenu: FC = () => {
  const translate = useTranslations('navigation.userMenu');

  return (
    <Button variant="ghost" disabled>
      {translate('label')}
    </Button>
  );
};
