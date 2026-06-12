import type { ButtonHTMLAttributes, FC } from 'react';

import { cn } from '../../lib/utils';
import styles from './Button.module.scss';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantToClass: Record<ButtonVariant, string> = {
  primary: styles.primary ?? '',
  secondary: styles.secondary ?? '',
  ghost: styles.ghost ?? '',
};

const sizeToClass: Record<ButtonSize, string> = {
  sm: styles.sm ?? '',
  md: styles.md ?? '',
  lg: styles.lg ?? '',
};

export const Button: FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  type = 'button',
  className,
  ...props
}) => (
  <button
    {...props}
    data-slot="button"
    type={type}
    className={cn(styles.button, variantToClass[variant], sizeToClass[size], className)}
  />
);
