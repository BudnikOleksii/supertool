'use client';

import type { CSSProperties, FC } from 'react';
import type { ToasterProps } from 'sonner';

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { Toaster as Sonner } from 'sonner';

import styles from './Toaster.module.scss';

const ICON_SIZE = 16;

const toasterStyle: CSSProperties & Record<`--${string}`, string> = {
  '--normal-bg': 'var(--surface-container)',
  '--normal-text': 'var(--on-surface)',
  '--normal-border': 'var(--outline-variant)',
  '--border-radius': 'var(--radius-lg)',
};

export const Toaster: FC<ToasterProps> = ({ theme = 'system', ...props }) => (
  <Sonner
    theme={theme}
    icons={{
      success: <CircleCheckIcon size={ICON_SIZE} />,
      info: <InfoIcon size={ICON_SIZE} />,
      warning: <TriangleAlertIcon size={ICON_SIZE} />,
      error: <OctagonXIcon size={ICON_SIZE} />,
      loading: <Loader2Icon size={ICON_SIZE} className={styles.spinner} />,
    }}
    style={toasterStyle}
    {...props}
  />
);
