'use client';

import type { FC } from 'react';

import {
  Content,
  Icon,
  Item,
  ItemIndicator,
  ItemText,
  Portal,
  Root,
  Trigger,
  Value,
  Viewport,
} from '@radix-ui/react-select';

import { cn } from '../../lib/utils';
import styles from './Select.module.scss';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  optionList: SelectOption[];
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
}

export const Select: FC<SelectProps> = ({
  value,
  onValueChange,
  optionList,
  ariaLabel,
  className,
  disabled = false,
}) => (
  <Root value={value} onValueChange={onValueChange} disabled={disabled}>
    <Trigger
      data-slot="select-trigger"
      className={cn(styles.trigger, className)}
      aria-label={ariaLabel}
    >
      <Value />
      <Icon className={styles.icon} aria-hidden>
        ▾
      </Icon>
    </Trigger>
    <Portal>
      <Content className={cn(styles.content, styles.popper)} position="popper" sideOffset={4}>
        <Viewport className={cn(styles.viewport, styles.popperViewport)}>
          {optionList.map((option) => (
            <Item key={option.value} value={option.value} className={styles.item}>
              <ItemText>{option.label}</ItemText>
              <ItemIndicator className={styles.itemIndicator} aria-hidden>
                ✓
              </ItemIndicator>
            </Item>
          ))}
        </Viewport>
      </Content>
    </Portal>
  </Root>
);
