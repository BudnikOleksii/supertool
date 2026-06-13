'use client';

import type { ComponentPropsWithoutRef, ComponentRef, FC, Ref } from 'react';

import { Content, Item, Portal, Root, Trigger } from '@radix-ui/react-dropdown-menu';

import { cn } from '../../../lib/utils';
import styles from './DropdownMenu.module.scss';

const DEFAULT_SIDE_OFFSET = 4;

export const DropdownMenu = Root;
export const DropdownMenuTrigger = Trigger;

interface DropdownMenuContentProps extends ComponentPropsWithoutRef<typeof Content> {
  ref?: Ref<ComponentRef<typeof Content>>;
}

export const DropdownMenuContent: FC<DropdownMenuContentProps> = ({
  className,
  sideOffset = DEFAULT_SIDE_OFFSET,
  ref,
  ...props
}) => (
  <Portal>
    <Content
      ref={ref}
      data-slot="dropdown-menu-content"
      sideOffset={sideOffset}
      className={cn(styles.content, className)}
      {...props}
    />
  </Portal>
);

interface DropdownMenuItemProps extends ComponentPropsWithoutRef<typeof Item> {
  ref?: Ref<ComponentRef<typeof Item>>;
}

export const DropdownMenuItem: FC<DropdownMenuItemProps> = ({ className, ref, ...props }) => (
  <Item
    ref={ref}
    data-slot="dropdown-menu-item"
    className={cn(styles.item, className)}
    {...props}
  />
);
