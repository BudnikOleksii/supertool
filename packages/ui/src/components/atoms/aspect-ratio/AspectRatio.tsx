import type { ComponentPropsWithoutRef, ComponentRef, FC, Ref } from 'react';

import * as AspectRatioPrimitive from '@radix-ui/react-aspect-ratio';

import { cn } from '../../../lib/utils';
import styles from './AspectRatio.module.scss';

const WIDESCREEN_WIDTH = 16;
const WIDESCREEN_HEIGHT = 9;
const DEFAULT_ASPECT_RATIO = WIDESCREEN_WIDTH / WIDESCREEN_HEIGHT;

export interface AspectRatioProps extends ComponentPropsWithoutRef<
  typeof AspectRatioPrimitive.Root
> {
  ratio?: number;
  ref?: Ref<ComponentRef<typeof AspectRatioPrimitive.Root>>;
}

export const AspectRatio: FC<AspectRatioProps> = ({
  className,
  ratio = DEFAULT_ASPECT_RATIO,
  ref,
  ...props
}) => (
  <AspectRatioPrimitive.Root
    ref={ref}
    data-slot="aspect-ratio"
    ratio={ratio}
    className={cn(styles.root, className)}
    {...props}
  />
);
