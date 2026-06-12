'use client';

import type { FC, ReactNode } from 'react';

import {
  Close,
  Content,
  Description,
  Overlay,
  Portal,
  Root,
  Title,
  Trigger,
} from '@radix-ui/react-dialog';

import { cn } from '../../lib/utils';
import styles from './Dialog.module.scss';

export interface DialogProps {
  trigger: ReactNode;
  title: string;
  description: string;
  closeLabel: string;
  children: ReactNode;
  className?: string;
}

export const Dialog: FC<DialogProps> = ({
  trigger,
  title,
  description,
  closeLabel,
  children,
  className,
}) => (
  <Root>
    <Trigger asChild>{trigger}</Trigger>
    <Portal>
      <Overlay className={styles.overlay} />
      <Content data-slot="dialog-content" className={cn(styles.content, className)}>
        <header className={styles.header}>
          <Title className={styles.title}>{title}</Title>
          <Close className={styles.close} aria-label={closeLabel}>
            ✕
          </Close>
        </header>
        <Description className={styles.description}>{description}</Description>
        {children}
      </Content>
    </Portal>
  </Root>
);
