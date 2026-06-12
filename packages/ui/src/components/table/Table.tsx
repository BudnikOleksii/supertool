import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';

import { cn } from '../../lib/utils';
import styles from './Table.module.scss';

export const Table = ({ className, ...props }: HTMLAttributes<HTMLTableElement>) => (
  <div className={styles.wrapper}>
    <table {...props} className={cn(styles.table, className)} />
  </div>
);

export const TableHead = (props: HTMLAttributes<HTMLTableSectionElement>) => <thead {...props} />;

export const TableBody = (props: HTMLAttributes<HTMLTableSectionElement>) => <tbody {...props} />;

export const TableRow = ({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) => (
  <tr {...props} className={cn(styles.row, className)} />
);

export const TableHeaderCell = ({
  className,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>) => (
  <th {...props} className={cn(styles.headerCell, className)} />
);

export const TableCell = ({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) => (
  <td {...props} className={cn(styles.cell, className)} />
);
