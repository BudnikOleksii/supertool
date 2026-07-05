import type { FC } from 'react';

const DEFAULT_ICON_SIZE = 18;
const YEAR_ICON_SIZE = 14;

interface ChevronIconBaseProps {
  pathData: string;
  size?: number;
}

const ChevronIcon: FC<ChevronIconBaseProps> = ({ pathData, size = DEFAULT_ICON_SIZE }) => (
  <svg
    width={size}
    height={size}
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

export const ChevronUpIcon: FC = () => (
  <ChevronIcon pathData="m18 15-6-6-6 6" size={YEAR_ICON_SIZE} />
);

export const ChevronDownIcon: FC = () => (
  <ChevronIcon pathData="m6 9 6 6 6-6" size={YEAR_ICON_SIZE} />
);
