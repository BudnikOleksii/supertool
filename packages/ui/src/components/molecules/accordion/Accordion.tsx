'use client';

import type { ComponentPropsWithoutRef, ComponentRef, FC, Ref } from 'react';

import { Content, Header, Item, Root, Trigger } from '@radix-ui/react-accordion';
import { ChevronDown } from 'lucide-react';

import { cn } from '../../../lib/utils';
import styles from './Accordion.module.scss';

const CHEVRON_SIZE = 16;

export const Accordion = Root;

interface AccordionItemProps extends ComponentPropsWithoutRef<typeof Item> {
  ref?: Ref<ComponentRef<typeof Item>>;
}

export const AccordionItem: FC<AccordionItemProps> = ({ className, ref, ...props }) => (
  <Item ref={ref} data-slot="accordion-item" className={cn(styles.item, className)} {...props} />
);

interface AccordionTriggerProps extends ComponentPropsWithoutRef<typeof Trigger> {
  ref?: Ref<ComponentRef<typeof Trigger>>;
}

export const AccordionTrigger: FC<AccordionTriggerProps> = ({
  className,
  children,
  ref,
  ...props
}) => (
  <Header className={styles.header}>
    <Trigger
      ref={ref}
      data-slot="accordion-trigger"
      className={cn(styles.trigger, className)}
      {...props}
    >
      {children}
      <ChevronDown className={styles.chevron} size={CHEVRON_SIZE} aria-hidden />
    </Trigger>
  </Header>
);

interface AccordionContentProps extends ComponentPropsWithoutRef<typeof Content> {
  ref?: Ref<ComponentRef<typeof Content>>;
}

export const AccordionContent: FC<AccordionContentProps> = ({
  className,
  children,
  ref,
  ...props
}) => (
  <Content
    ref={ref}
    data-slot="accordion-content"
    className={cn(styles.content, className)}
    {...props}
  >
    <div className={styles.contentInner}>{children}</div>
  </Content>
);
