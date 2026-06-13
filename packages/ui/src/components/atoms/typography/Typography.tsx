import type { CSSProperties, ElementType, JSX, PropsWithChildren } from 'react';

import { cn } from '../../../lib/utils';
import styles from './Typography.module.scss';

export type TypographyVariant =
  | 'title-xl'
  | 'title-l'
  | 'title-m'
  | 'title-s'
  | 'title-xs'
  | 'body-l'
  | 'body-m'
  | 'body-s';

export type FontWeight = 'regular' | 'medium' | 'semibold' | 'bold' | 'extra-bold';

const VARIANT_TAG_MAP: Record<TypographyVariant, ElementType> = {
  'title-xl': 'h1',
  'title-l': 'h2',
  'title-m': 'h3',
  'title-s': 'h4',
  'title-xs': 'h5',
  'body-l': 'p',
  'body-m': 'p',
  'body-s': 'p',
};

const VARIANT_STYLES_MAP: Record<TypographyVariant, string | undefined> = {
  'title-xl': styles.titleXl,
  'title-l': styles.titleL,
  'title-m': styles.titleM,
  'title-s': styles.titleS,
  'title-xs': styles.titleXs,
  'body-l': styles.bodyL,
  'body-m': styles.bodyM,
  'body-s': styles.bodyS,
};

const FONT_WEIGHT_MAP: Record<FontWeight, string> = {
  regular: 'var(--font-weight-regular)',
  medium: 'var(--font-weight-medium)',
  semibold: 'var(--font-weight-semibold)',
  bold: 'var(--font-weight-bold)',
  'extra-bold': 'var(--font-weight-extra-bold)',
};

type IntrinsicElementsKeys = keyof JSX.IntrinsicElements;

interface TypographyBaseProps {
  variant?: TypographyVariant | undefined;
  fontWeight?: FontWeight | undefined;
  className?: string | undefined;
}

export type TypographyProps<T extends IntrinsicElementsKeys> = TypographyBaseProps &
  Omit<JSX.IntrinsicElements[T], keyof TypographyBaseProps> & {
    tag?: T;
  };

export const Typography = <T extends IntrinsicElementsKeys = 'p'>({
  variant = 'body-m',
  tag,
  fontWeight,
  className,
  style,
  children,
  ...rest
}: PropsWithChildren<TypographyProps<T>>): JSX.Element => {
  const Component: ElementType = tag ?? VARIANT_TAG_MAP[variant];
  const variantClass = VARIANT_STYLES_MAP[variant];

  const combinedStyle: CSSProperties = {
    ...style,
    ...(fontWeight && { fontWeight: FONT_WEIGHT_MAP[fontWeight] }),
  };

  return (
    <Component className={cn(variantClass, className)} style={combinedStyle} {...rest}>
      {children}
    </Component>
  );
};
