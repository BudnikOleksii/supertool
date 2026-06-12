import type { ButtonHTMLAttributes } from 'react';

import { cn } from '../../lib/utils';
import styles from './Button.module.scss';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'small' | 'medium' | 'large';
}

export const Button = ({
  variant = 'primary',
  size = 'medium',
  type = 'button',
  className,
  ...props
}: ButtonProps) => (
  <button
    {...props}
    type={type}
    className={cn(styles.button, styles[variant], styles[size], className)}
  />
);
