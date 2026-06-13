'use client';

import type { ComponentPropsWithoutRef, ComponentRef, HTMLAttributes, Ref } from 'react';

import {
  Action,
  Cancel,
  Content,
  Description,
  Overlay,
  Portal,
  Root,
  Title,
  Trigger,
} from '@radix-ui/react-alert-dialog';

import { cn } from '../../../lib/utils';
import { Typography } from '../../atoms/typography/Typography';
import styles from './AlertDialog.module.scss';

export const AlertDialog = Root;
export const AlertDialogTrigger = Trigger;

interface AlertDialogOverlayProps extends ComponentPropsWithoutRef<typeof Overlay> {
  ref?: Ref<ComponentRef<typeof Overlay>>;
}

const AlertDialogOverlay = ({ className, ref, ...props }: AlertDialogOverlayProps) => (
  <Overlay ref={ref} className={cn(styles.overlay, className)} {...props} />
);

interface AlertDialogContentProps extends ComponentPropsWithoutRef<typeof Content> {
  size?: 'default' | 'sm';
  ref?: Ref<ComponentRef<typeof Content>>;
}

export const AlertDialogContent = ({
  className,
  size = 'default',
  children,
  ref,
  ...props
}: AlertDialogContentProps) => (
  <Portal>
    <AlertDialogOverlay />
    <Content
      ref={ref}
      data-slot="alert-dialog-content"
      className={cn(styles.content, size === 'sm' && styles.contentSm, className)}
      {...props}
    >
      {children}
    </Content>
  </Portal>
);

export const AlertDialogHeader = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div data-slot="alert-dialog-header" className={cn(styles.header, className)} {...props} />
);

export const AlertDialogFooter = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div data-slot="alert-dialog-footer" className={cn(styles.footer, className)} {...props} />
);

export const AlertDialogTitle = ({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof Title>) => (
  <Title asChild {...props}>
    <Typography
      tag="h2"
      variant="title-m"
      fontWeight="semibold"
      data-slot="alert-dialog-title"
      className={cn(styles.title, className)}
    >
      {children}
    </Typography>
  </Title>
);

export const AlertDialogDescription = ({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof Description>) => (
  <Description asChild {...props}>
    <Typography
      variant="body-m"
      data-slot="alert-dialog-description"
      className={cn(styles.description, className)}
    >
      {children}
    </Typography>
  </Description>
);

interface AlertDialogActionProps extends ComponentPropsWithoutRef<typeof Action> {
  ref?: Ref<ComponentRef<typeof Action>>;
}

export const AlertDialogAction = ({ ref, ...props }: AlertDialogActionProps) => (
  <Action ref={ref} asChild {...props} />
);

interface AlertDialogCancelProps extends ComponentPropsWithoutRef<typeof Cancel> {
  ref?: Ref<ComponentRef<typeof Cancel>>;
}

export const AlertDialogCancel = ({ ref, ...props }: AlertDialogCancelProps) => (
  <Cancel ref={ref} asChild {...props} />
);
