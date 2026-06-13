'use client';

import type { FC } from 'react';

import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '../../../lib/utils';
import { Button } from '../../atoms/button/Button';
import { Typography } from '../../atoms/typography/Typography';
import styles from './Pagination.module.scss';

const FIRST_PAGE = 1;
const SINGLE_PAGE = 1;
const PAGE_STEP = 1;
const MINIMUM_LIMIT = 1;
const CHEVRON_SIZE = 16;

export interface PaginationProps {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
  previousLabel?: string;
  nextLabel?: string;
  renderInfo?: (page: number, totalPages: number) => string;
  className?: string;
}

export const Pagination: FC<PaginationProps> = ({
  page,
  limit,
  total,
  onPageChange,
  previousLabel = 'Previous page',
  nextLabel = 'Next page',
  renderInfo,
  className,
}) => {
  const totalPageCount = limit < MINIMUM_LIMIT ? SINGLE_PAGE : Math.ceil(total / limit);

  if (totalPageCount <= SINGLE_PAGE) {
    return null;
  }

  const currentPage = Math.min(Math.max(page, FIRST_PAGE), totalPageCount);
  const hasPrevious = currentPage > FIRST_PAGE;
  const hasNext = currentPage < totalPageCount;

  const handlePrevious = () => {
    onPageChange(currentPage - PAGE_STEP);
  };

  const handleNext = () => {
    onPageChange(currentPage + PAGE_STEP);
  };

  return (
    <div className={cn(styles.pagination, className)}>
      <Button
        variant="outline"
        size="sm"
        disabled={!hasPrevious}
        onClick={handlePrevious}
        aria-label={previousLabel}
      >
        <ChevronLeft size={CHEVRON_SIZE} aria-hidden />
      </Button>

      <Typography variant="body-s" className={styles.info}>
        {renderInfo
          ? renderInfo(currentPage, totalPageCount)
          : `${currentPage} / ${totalPageCount}`}
      </Typography>

      <Button
        variant="outline"
        size="sm"
        disabled={!hasNext}
        onClick={handleNext}
        aria-label={nextLabel}
      >
        <ChevronRight size={CHEVRON_SIZE} aria-hidden />
      </Button>
    </div>
  );
};
