import type { Meta, StoryObj } from '@storybook/react-vite';

import { useState } from 'react';
import { fn } from 'storybook/test';

import { Pagination } from '@supertool/ui/src/components/molecules/pagination/Pagination';

const meta = {
  title: 'Primitives/Pagination',
  component: Pagination,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  args: { page: 1, limit: 20, total: 100, onPageChange: fn() },
} satisfies Meta<typeof Pagination>;

export default meta;

type Story = StoryObj<typeof meta>;

const PaginationDemo = ({ initialPage }: { initialPage: number }) => {
  const [page, setPage] = useState(initialPage);

  return <Pagination page={page} limit={20} total={100} onPageChange={setPage} />;
};

export const FirstPage: Story = {
  render: () => <PaginationDemo initialPage={1} />,
};

export const MiddlePage: Story = {
  render: () => <PaginationDemo initialPage={3} />,
};

export const LastPage: Story = {
  render: () => <PaginationDemo initialPage={5} />,
};
