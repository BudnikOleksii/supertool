import type { ComponentPropsWithoutRef, ComponentRef, FC, Ref } from 'react';

import * as SeparatorPrimitive from '@radix-ui/react-separator';

import { cn } from '../../../lib/utils';
import styles from './Separator.module.scss';

export interface SeparatorProps extends ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root> {
  ref?: Ref<ComponentRef<typeof SeparatorPrimitive.Root>>;
}

export const Separator: FC<SeparatorProps> = ({
  className,
  orientation = 'horizontal',
  decorative = true,
  ref,
  ...props
}) => (
  <SeparatorPrimitive.Root
    ref={ref}
    data-slot="separator"
    decorative={decorative}
    orientation={orientation}
    className={cn(styles.separator, className)}
    {...props}
  />
);
