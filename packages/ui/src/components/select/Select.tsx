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
  ScrollDownButton,
  ScrollUpButton,
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
  error?: boolean;
}

export const Select: FC<SelectProps> = ({
  value,
  onValueChange,
  optionList,
  ariaLabel,
  className,
  disabled = false,
  error = false,
}) => (
  <Root value={value} onValueChange={onValueChange} disabled={disabled}>
    <Trigger
      data-slot="select-trigger"
      aria-invalid={error || undefined}
      className={cn(styles.trigger, error && styles.error, className)}
      aria-label={ariaLabel}
    >
      <Value />
      <Icon asChild>
        <span className={styles.icon} aria-hidden>
          ▼
        </span>
      </Icon>
    </Trigger>
    <Portal>
      <Content
        data-slot="select-content"
        className={cn(styles.content, styles.popper)}
        position="popper"
        sideOffset={4}
      >
        <ScrollUpButton className={styles.scrollButton}>
          <span aria-hidden>▲</span>
        </ScrollUpButton>
        <Viewport className={cn(styles.viewport, styles.popperViewport)}>
          {optionList.map((option) => (
            <Item
              key={option.value}
              value={option.value}
              data-slot="select-item"
              className={styles.item}
            >
              <ItemText>{option.label}</ItemText>
              <ItemIndicator className={styles.itemIndicator}>
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden>
                  <path
                    d="M1 4l3 3 5-6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </ItemIndicator>
            </Item>
          ))}
        </Viewport>
        <ScrollDownButton className={styles.scrollButton}>
          <span aria-hidden>▼</span>
        </ScrollDownButton>
      </Content>
    </Portal>
  </Root>
);
