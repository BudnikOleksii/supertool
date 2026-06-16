'use client';

import type { ComponentPropsWithoutRef, ComponentRef, FC, Ref } from 'react';

import {
  Content,
  Item,
  ItemIndicator,
  Label,
  Portal,
  RadioGroup,
  RadioItem,
  Root,
  Separator,
  Trigger,
} from '@radix-ui/react-dropdown-menu';
import { Check } from 'lucide-react';

import { cn } from '../../../lib/utils';
import styles from './DropdownMenu.module.scss';

const DEFAULT_SIDE_OFFSET = 4;
const RADIO_INDICATOR_SIZE = 14;

export const DropdownMenu = Root;
export const DropdownMenuTrigger = Trigger;
export const DropdownMenuRadioGroup = RadioGroup;

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

interface DropdownMenuLabelProps extends ComponentPropsWithoutRef<typeof Label> {
  ref?: Ref<ComponentRef<typeof Label>>;
}

export const DropdownMenuLabel: FC<DropdownMenuLabelProps> = ({ className, ref, ...props }) => (
  <Label
    ref={ref}
    data-slot="dropdown-menu-label"
    className={cn(styles.label, className)}
    {...props}
  />
);

interface DropdownMenuSeparatorProps extends ComponentPropsWithoutRef<typeof Separator> {
  ref?: Ref<ComponentRef<typeof Separator>>;
}

export const DropdownMenuSeparator: FC<DropdownMenuSeparatorProps> = ({
  className,
  ref,
  ...props
}) => (
  <Separator
    ref={ref}
    data-slot="dropdown-menu-separator"
    className={cn(styles.separator, className)}
    {...props}
  />
);

interface DropdownMenuRadioItemProps extends ComponentPropsWithoutRef<typeof RadioItem> {
  ref?: Ref<ComponentRef<typeof RadioItem>>;
}

export const DropdownMenuRadioItem: FC<DropdownMenuRadioItemProps> = ({
  className,
  children,
  ref,
  ...props
}) => (
  <RadioItem
    ref={ref}
    data-slot="dropdown-menu-radio-item"
    className={cn(styles.item, styles.radioItem, className)}
    {...props}
  >
    <span className={styles.radioIndicator}>
      <ItemIndicator>
        <Check size={RADIO_INDICATOR_SIZE} aria-hidden="true" />
      </ItemIndicator>
    </span>
    {children}
  </RadioItem>
);
