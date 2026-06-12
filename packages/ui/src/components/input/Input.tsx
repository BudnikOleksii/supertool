import type { FC, InputHTMLAttributes } from 'react';

import { cn } from '../../lib/utils';
import styles from './Input.module.scss';

export const Input: FC<InputHTMLAttributes<HTMLInputElement>> = ({ className, ...props }) => (
  <input {...props} data-slot="input" className={cn(styles.input, className)} />
);
