'use client';

import type { ComponentPropsWithoutRef, ComponentRef, FC, Ref } from 'react';

import * as AvatarPrimitive from '@radix-ui/react-avatar';

import { cn } from '../../../lib/utils';
import styles from './Avatar.module.scss';

type AvatarSize = 'default' | 'sm' | 'lg';

export interface AvatarProps extends ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> {
  size?: AvatarSize;
  ref?: Ref<ComponentRef<typeof AvatarPrimitive.Root>>;
}

export const Avatar: FC<AvatarProps> = ({ className, size = 'default', ref, ...props }) => (
  <AvatarPrimitive.Root
    ref={ref}
    data-slot="avatar"
    className={cn(styles.root, size === 'sm' && styles.sm, size === 'lg' && styles.lg, className)}
    {...props}
  />
);

export interface AvatarImageProps extends ComponentPropsWithoutRef<typeof AvatarPrimitive.Image> {
  ref?: Ref<ComponentRef<typeof AvatarPrimitive.Image>>;
}

export const AvatarImage: FC<AvatarImageProps> = ({ className, ref, ...props }) => (
  <AvatarPrimitive.Image
    ref={ref}
    data-slot="avatar-image"
    className={cn(styles.image, className)}
    {...props}
  />
);

export interface AvatarFallbackProps extends ComponentPropsWithoutRef<
  typeof AvatarPrimitive.Fallback
> {
  ref?: Ref<ComponentRef<typeof AvatarPrimitive.Fallback>>;
}

export const AvatarFallback: FC<AvatarFallbackProps> = ({ className, ref, ...props }) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    data-slot="avatar-fallback"
    className={cn(styles.fallback, className)}
    {...props}
  />
);
