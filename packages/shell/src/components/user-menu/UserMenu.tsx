import { useTranslations } from 'next-intl';

import { Button } from '@supertool/ui/src/components/button/Button';

export const UserMenu = () => {
  const translate = useTranslations('shell.userMenu');

  return (
    <Button variant="ghost" disabled>
      {translate('label')}
    </Button>
  );
};
