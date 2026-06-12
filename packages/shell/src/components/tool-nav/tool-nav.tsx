import { useTranslations } from 'next-intl';

import { NavigationLink } from '@supertool/next-shared/src/i18n/navigation/navigation-link';
import type { ToolRegistryEntry } from '@supertool/shared/constants/tools';

import styles from './tool-nav.module.scss';

export interface ToolNavProps {
  tools: ToolRegistryEntry[];
}

export const ToolNav = ({ tools }: ToolNavProps) => {
  const translate = useTranslations();

  return (
    <nav className={styles.nav} aria-label={translate('shell.nav.label')}>
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
