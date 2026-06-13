import type { AnchorHTMLAttributes, ComponentProps, ElementType, Ref } from 'react';

import { cn } from '../../../lib/utils';
import styles from './UnderlineLink.module.scss';

type UnderlineLinkAsAnchorProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  component?: never;
  ref?: Ref<HTMLAnchorElement>;
};

type UnderlineLinkAsComponentProps<Comp extends ElementType> = Omit<
  ComponentProps<Comp>,
  'component'
> & {
  component: Comp;
};

export type UnderlineLinkProps<Comp extends ElementType = 'a'> = Comp extends 'a'
  ? UnderlineLinkAsAnchorProps
  : UnderlineLinkAsComponentProps<Comp>;

export const UnderlineLink = <Comp extends ElementType = 'a'>(props: UnderlineLinkProps<Comp>) => {
  const { className, component, ...rest } = props;

  const Component: ElementType = component ?? 'a';

  return <Component data-slot="underline-link" className={cn(styles.link, className)} {...rest} />;
};
