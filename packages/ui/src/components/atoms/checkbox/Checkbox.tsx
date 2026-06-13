'use client';

import type { ComponentPropsWithoutRef, ComponentRef, FC, Ref } from 'react';

import * as CheckboxPrimitive from '@radix-ui/react-checkbox';

import { cn } from '../../../lib/utils';
import styles from './Checkbox.module.scss';

export interface CheckboxProps extends ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {
  error?: boolean | undefined;
  ref?: Ref<ComponentRef<typeof CheckboxPrimitive.Root>>;
}

export const Checkbox: FC<CheckboxProps> = ({ className, error, ref, ...props }) => (
  <CheckboxPrimitive.Root
    ref={ref}
    data-slot="checkbox"
    aria-invalid={error || undefined}
    className={cn(styles.root, error && styles.error, className)}
    {...props}
  >
    <CheckboxPrimitive.Indicator data-slot="checkbox-indicator" className={styles.indicator}>
      <svg
        width="10"
        height="2"
        viewBox="0 0 10 2"
        fill="none"
        aria-hidden
        className={styles.indeterminateIcon}
      >
        <path d="M1 1h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <svg
        width="10"
        height="8"
        viewBox="0 0 10 8"
        fill="none"
        aria-hidden
        className={styles.checkIcon}
      >
        <path
          d="M1 4l3 3 5-6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
);
