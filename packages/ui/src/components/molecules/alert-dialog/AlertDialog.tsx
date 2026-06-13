'use client';

import type { ComponentPropsWithoutRef, ComponentRef, FC, HTMLAttributes, Ref } from 'react';

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

const AlertDialogOverlay: FC<AlertDialogOverlayProps> = ({ className, ref, ...props }) => (
  <Overlay ref={ref} className={cn(styles.overlay, className)} {...props} />
);

interface AlertDialogContentProps extends ComponentPropsWithoutRef<typeof Content> {
  size?: 'default' | 'sm';
  ref?: Ref<ComponentRef<typeof Content>>;
}

export const AlertDialogContent: FC<AlertDialogContentProps> = ({
  className,
  size = 'default',
  children,
  ref,
  ...props
}) => (
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

export const AlertDialogHeader: FC<HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div data-slot="alert-dialog-header" className={cn(styles.header, className)} {...props} />
);

export const AlertDialogFooter: FC<HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div data-slot="alert-dialog-footer" className={cn(styles.footer, className)} {...props} />
);

export const AlertDialogTitle: FC<ComponentPropsWithoutRef<typeof Title>> = ({
  className,
  children,
  ...props
}) => (
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

export const AlertDialogDescription: FC<ComponentPropsWithoutRef<typeof Description>> = ({
  className,
  children,
  ...props
}) => (
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

export const AlertDialogAction: FC<AlertDialogActionProps> = ({ ref, ...props }) => (
  <Action ref={ref} asChild {...props} />
);

interface AlertDialogCancelProps extends ComponentPropsWithoutRef<typeof Cancel> {
  ref?: Ref<ComponentRef<typeof Cancel>>;
}

export const AlertDialogCancel: FC<AlertDialogCancelProps> = ({ ref, ...props }) => (
  <Cancel ref={ref} asChild {...props} />
);
