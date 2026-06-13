import type { FC, HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';

import { cn } from '../../../lib/utils';
import styles from './Table.module.scss';

export const Table: FC<HTMLAttributes<HTMLTableElement>> = ({ className, ...props }) => (
  <div className={styles.wrapper}>
    <table {...props} data-slot="table" className={cn(styles.table, className)} />
  </div>
);

export const TableHead: FC<HTMLAttributes<HTMLTableSectionElement>> = (props) => (
  <thead {...props} />
);

export const TableBody: FC<HTMLAttributes<HTMLTableSectionElement>> = (props) => (
  <tbody {...props} />
);

export const TableRow: FC<HTMLAttributes<HTMLTableRowElement>> = ({ className, ...props }) => (
  <tr {...props} className={cn(styles.row, className)} />
);

export const TableHeaderCell: FC<ThHTMLAttributes<HTMLTableCellElement>> = ({
  className,
  ...props
}) => <th {...props} className={cn(styles.headerCell, className)} />;

export const TableCell: FC<TdHTMLAttributes<HTMLTableCellElement>> = ({ className, ...props }) => (
  <td {...props} className={cn(styles.cell, className)} />
);
