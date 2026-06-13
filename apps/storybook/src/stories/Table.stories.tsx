import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@supertool/ui/src/components/molecules/table/Table';

const meta = {
  title: 'Primitives/Table',
  component: Table,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Table>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeaderCell>Date</TableHeaderCell>
          <TableHeaderCell>Category</TableHeaderCell>
          <TableHeaderCell>Amount</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        <TableRow>
          <TableCell>2026-06-10</TableCell>
          <TableCell>Food</TableCell>
          <TableCell>-250.00</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>2026-06-01</TableCell>
          <TableCell>Salary</TableCell>
          <TableCell>52000.00</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
};
