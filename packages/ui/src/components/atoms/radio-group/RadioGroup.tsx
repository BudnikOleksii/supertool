'use client';

import type { ComponentPropsWithoutRef, ComponentRef, FC, Ref } from 'react';

import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';

import { cn } from '../../../lib/utils';
import styles from './RadioGroup.module.scss';

export interface RadioGroupProps extends ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root> {
  ref?: Ref<ComponentRef<typeof RadioGroupPrimitive.Root>>;
}

export const RadioGroup: FC<RadioGroupProps> = ({ className, ref, ...props }) => (
  <RadioGroupPrimitive.Root
    ref={ref}
    data-slot="radio-group"
    className={cn(styles.root, className)}
    {...props}
  />
);

export interface RadioGroupItemProps extends ComponentPropsWithoutRef<
  typeof RadioGroupPrimitive.Item
> {
  ref?: Ref<ComponentRef<typeof RadioGroupPrimitive.Item>>;
}

export const RadioGroupItem: FC<RadioGroupItemProps> = ({ className, children, ref, ...props }) => (
  <RadioGroupPrimitive.Item
    ref={ref}
    data-slot="radio-group-item"
    className={cn(styles.item, className)}
    {...props}
  >
    {children}
  </RadioGroupPrimitive.Item>
);
