import type { InputHTMLAttributes } from 'react';

import { cn } from '../../lib/utils';
import styles from './input.module.scss';

export const Input = ({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) => (
  <input {...props} className={cn(styles.input, className)} />
);
