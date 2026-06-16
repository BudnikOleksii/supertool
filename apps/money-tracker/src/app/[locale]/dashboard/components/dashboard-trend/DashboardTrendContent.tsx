'use client';

import type { FC } from 'react';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { formatAmount } from '../../../../../utils/format-amount';

const CHART_HEIGHT = 300;
const GRID_OPACITY = 0.4;
const CURSOR_OPACITY = 0.15;
const TOOLTIP_RADIUS = '0.5rem';

interface TrendChartDatum {
  label: string;
  income: number;
  expense: number;
  incomeAmount: string;
  expenseAmount: string;
}

interface Props {
  chartData: TrendChartDatum[];
  incomeName: string;
  expenseName: string;
  currency: string;
  locale: string;
}

interface ChartColors {
  income: string;
  expense: string;
  axis: string;
  grid: string;
  surface: string;
  onSurface: string;
  outline: string;
}

const EMPTY_COLORS: ChartColors = {
  income: '',
  expense: '',
  axis: '',
  grid: '',
  surface: '',
  onSurface: '',
  outline: '',
};

const readToken = (token: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(token).trim();

const readChartColors = (): ChartColors => ({
  income: readToken('--on-success-container'),
  expense: readToken('--error'),
  axis: readToken('--on-surface-variant'),
  grid: readToken('--outline-variant'),
  surface: readToken('--surface-container'),
  onSurface: readToken('--on-surface'),
  outline: readToken('--outline-variant'),
});

export const DashboardTrendContent: FC<Props> = ({
  chartData,
  incomeName,
  expenseName,
  currency,
  locale,
}) => {
  const { resolvedTheme } = useTheme();
  const [colors, setColors] = useState<ChartColors>(EMPTY_COLORS);

  useEffect(() => {
    setColors(readChartColors());
  }, [resolvedTheme]);

  if (colors.income === '') {
    return <div style={{ height: CHART_HEIGHT }} aria-hidden="true" />;
  }

  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <BarChart data={chartData}>
        <CartesianGrid vertical={false} stroke={colors.grid} strokeOpacity={GRID_OPACITY} />
        <XAxis dataKey="label" tick={{ fill: colors.axis }} stroke={colors.axis} />
        <YAxis tick={{ fill: colors.axis }} stroke={colors.axis} />
        <Tooltip
          formatter={(value, name, item) => {
            const datum = item.payload;
            const rawAmount = name === incomeName ? datum?.incomeAmount : datum?.expenseAmount;

            return formatAmount(
              typeof rawAmount === 'string' ? rawAmount : String(value),
              currency,
              locale,
            );
          }}
          contentStyle={{
            backgroundColor: colors.surface,
            border: `1px solid ${colors.outline}`,
            borderRadius: TOOLTIP_RADIUS,
          }}
          labelStyle={{ color: colors.onSurface }}
          itemStyle={{ color: colors.onSurface }}
          cursor={{ fill: colors.axis, fillOpacity: CURSOR_OPACITY }}
        />
        <Legend wrapperStyle={{ color: colors.axis }} />
        <Bar dataKey="income" name={incomeName} fill={colors.income} isAnimationActive={false} />
        <Bar dataKey="expense" name={expenseName} fill={colors.expense} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
};
