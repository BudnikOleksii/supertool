import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  href: string;
  labelKey: string;
  Icon?: LucideIcon;
  children?: NavItem[];
  disabled?: boolean;
}
