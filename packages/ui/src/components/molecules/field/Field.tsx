'use client';

import type { ComponentProps, FC, ReactNode } from 'react';

import { useMemo } from 'react';

import { cn } from '../../../lib/utils';
import { Label } from '../../atoms/label/Label';
import { Separator } from '../../atoms/separator/Separator';
import styles from './Field.module.scss';

const FIELD_ERROR_MIN_LENGTH = 1;
const FIRST_ARRAY_ELEMENT = 0;

type FieldOrientation = 'vertical' | 'horizontal' | 'responsive';

export const FieldSet: FC<ComponentProps<'fieldset'>> = ({ className, ...props }) => (
  <fieldset data-slot="field-set" className={cn(styles.fieldSet, className)} {...props} />
);

export const FieldLegend: FC<ComponentProps<'legend'> & { variant?: 'legend' | 'label' }> = ({
  className,
  variant = 'legend',
  ...props
}) => (
  <legend
    data-slot="field-legend"
    data-variant={variant}
    className={cn(styles.fieldLegend, className)}
    {...props}
  />
);

export const FieldGroup: FC<ComponentProps<'div'>> = ({ className, ...props }) => (
  <div data-slot="field-group" className={cn(styles.fieldGroup, className)} {...props} />
);

export const Field: FC<ComponentProps<'div'> & { orientation?: FieldOrientation }> = ({
  className,
  orientation = 'vertical',
  ...props
}) => (
  <div
    role="group"
    data-slot="field"
    data-orientation={orientation}
    className={cn(styles.field, className)}
    {...props}
  />
);

export const FieldContent: FC<ComponentProps<'div'>> = ({ className, ...props }) => (
  <div data-slot="field-content" className={cn(styles.fieldContent, className)} {...props} />
);

export const FieldLabel: FC<ComponentProps<typeof Label>> = ({ className, ...props }) => (
  <Label data-slot="field-label" className={cn(styles.fieldLabel, className)} {...props} />
);

export const FieldTitle: FC<ComponentProps<'div'>> = ({ className, ...props }) => (
  <div data-slot="field-title" className={cn(styles.fieldTitle, className)} {...props} />
);

export const FieldDescription: FC<ComponentProps<'p'>> = ({ className, ...props }) => (
  <p data-slot="field-description" className={cn(styles.fieldDescription, className)} {...props} />
);

export const FieldSeparator: FC<ComponentProps<'div'> & { children?: ReactNode }> = ({
  children,
  className,
  ...props
}) => (
  <div
    data-slot="field-separator"
    data-content={Boolean(children)}
    className={cn(styles.fieldSeparator, className)}
    {...props}
  >
    <Separator className={styles.fieldSeparatorLine} />
    {children && (
      <span data-slot="field-separator-content" className={styles.fieldSeparatorContent}>
        {children}
      </span>
    )}
  </div>
);

interface FieldErrorEntry {
  message?: string;
}

export const FieldError: FC<
  ComponentProps<'div'> & { errors?: (FieldErrorEntry | undefined)[] | undefined }
> = ({ className, children, errors, ...props }) => {
  const content = useMemo(() => {
    if (children) {
      return children;
    }

    if (!errors?.length) {
      return null;
    }

    const uniqueErrorList = [...new Map(errors.map((error) => [error?.message, error])).values()];

    if (uniqueErrorList.length === FIELD_ERROR_MIN_LENGTH) {
      return uniqueErrorList[FIRST_ARRAY_ELEMENT]?.message;
    }

    return (
      <ul className={styles.fieldErrorList}>
        {uniqueErrorList.map(
          (error) => error?.message && <li key={error.message}>{error.message}</li>,
        )}
      </ul>
    );
  }, [children, errors]);

  if (!content) {
    return null;
  }

  return (
    <div
      role="alert"
      data-slot="field-error"
      className={cn(styles.fieldError, className)}
      {...props}
    >
      {content}
    </div>
  );
};

export const FormField: FC<
  ComponentProps<'div'> & {
    label: string;
    htmlFor?: string;
    error?: FieldErrorEntry | undefined;
    orientation?: FieldOrientation | undefined;
  }
> = ({ label, htmlFor, error, orientation = 'vertical', children, ...props }) => (
  <Field orientation={orientation} {...props}>
    <FieldLabel htmlFor={htmlFor}>{label}</FieldLabel>
    {children}
    <FieldError errors={error ? [error] : undefined} />
  </Field>
);
