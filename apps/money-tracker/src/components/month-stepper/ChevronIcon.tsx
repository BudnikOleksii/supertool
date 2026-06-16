import type { FC } from 'react';

const ICON_SIZE = 18;

interface ChevronIconBaseProps {
  pathData: string;
}

const ChevronIcon: FC<ChevronIconBaseProps> = ({ pathData }) => (
  <svg
    width={ICON_SIZE}
    height={ICON_SIZE}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d={pathData} />
  </svg>
);

export const ChevronLeftIcon: FC = () => <ChevronIcon pathData="m15 18-6-6 6-6" />;

export const ChevronRightIcon: FC = () => <ChevronIcon pathData="m9 18 6-6-6-6" />;
