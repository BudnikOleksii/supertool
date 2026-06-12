'use client';

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

export const Select = ({
  value,
  onValueChange,
  optionList,
  ariaLabel,
  className,
  disabled = false,
}: SelectProps) => (
  <Root value={value} onValueChange={onValueChange} disabled={disabled}>
    <Trigger className={cn(styles.trigger, className)} aria-label={ariaLabel}>
      <Value />
      <Icon className={styles.icon} aria-hidden>
        ▾
      </Icon>
    </Trigger>
    <Portal>
      <Content className={styles.content} position="popper" sideOffset={4}>
        <Viewport className={styles.viewport}>
          {optionList.map((option) => (
            <Item key={option.value} value={option.value} className={styles.item}>
              <ItemText>{option.label}</ItemText>
              <ItemIndicator className={styles.indicator} aria-hidden>
                ✓
              </ItemIndicator>
            </Item>
          ))}
        </Viewport>
      </Content>
    </Portal>
  </Root>
);
