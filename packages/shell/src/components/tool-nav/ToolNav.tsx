import type { FC } from 'react';

import { useTranslations } from 'next-intl';

import { NavigationLink } from '@supertool/next-shared/src/i18n/navigation/NavigationLink';
import type { ToolRegistryEntry } from '@supertool/shared/constants/tools';

import styles from './ToolNav.module.scss';

export interface ToolNavProps {
  tools: ToolRegistryEntry[];
}

export const ToolNav: FC<ToolNavProps> = ({ tools }) => {
  const translate = useTranslations();

  return (
    <nav className={styles.nav} aria-label={translate('navigation.label')}>
      <ul className={styles.list}>
        {tools.map((tool) => (
          <li key={tool.id}>
            <NavigationLink href={tool.path} className={styles.link}>
              {translate(tool.nameKey)}
            </NavigationLink>
          </li>
        ))}
      </ul>
    </nav>
  );
};
