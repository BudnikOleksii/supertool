import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from './Table';

describe('Table', () => {
  it('renders a table with the correct semantic structure', () => {
    render(
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Name</TableHeaderCell>
            <TableHeaderCell>Amount</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          <TableRow>
            <TableCell>Coffee</TableCell>
            <TableCell>3.50</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    screen.getByRole('table');
    screen.getByRole('columnheader', { name: 'Name' });
    screen.getByRole('columnheader', { name: 'Amount' });
    screen.getByRole('cell', { name: 'Coffee' });
    screen.getByRole('cell', { name: '3.50' });
  });

  it('forwards className on TableRow', () => {
    render(
      <Table>
        <TableBody>
          <TableRow className="highlight">
            <TableCell>Item</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.getByRole('row').className).toContain('highlight');
  });
});
