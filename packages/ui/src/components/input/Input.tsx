import type { FC, InputHTMLAttributes, ReactNode, Ref } from 'react';

import { cn } from '../../lib/utils';
import styles from './Input.module.scss';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  ref?: Ref<HTMLInputElement>;
  startAdornment?: ReactNode;
}

export const Input: FC<InputProps> = ({
  className,
  error,
  type,
  ref,
  startAdornment,
  ...props
}) => {
  if (startAdornment) {
    return (
      <div
        className={cn(
          styles.wrapper,
          error && styles.wrapperError,
          props.disabled && styles.wrapperDisabled,
          className,
        )}
      >
        <span className={styles.adornment}>{startAdornment}</span>
        <input
          ref={ref}
          type={type}
          data-slot="input"
          aria-invalid={error || undefined}
          className={styles.adornmentInput}
          {...props}
        />
      </div>
    );
  }

  return (
    <input
      ref={ref}
      type={type}
      data-slot="input"
      aria-invalid={error || undefined}
      className={cn(styles.input, error && styles.error, className)}
      {...props}
    />
  );
};
