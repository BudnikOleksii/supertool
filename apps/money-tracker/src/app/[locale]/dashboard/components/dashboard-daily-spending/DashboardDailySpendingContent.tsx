'use client';

import type { FC } from 'react';

import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { formatAmount } from '../../../../../utils/format-amount';

const CHART_HEIGHT = 300;
const GRID_OPACITY = 0.4;
const CURSOR_OPACITY = 0.15;
const TOOLTIP_RADIUS = '0.5rem';
const THEME_ATTRIBUTE = 'data-theme';

interface DailyChartDatum {
  label: string;
  value: number;
  amount: string;
}

interface Props {
  chartData: DailyChartDatum[];
  expenseName: string;
  currency: string;
  locale: string;
}

interface ChartColors {
  expense: string;
  axis: string;
  grid: string;
  surface: string;
  onSurface: string;
  outline: string;
}

const CHART_COLOR_TOKENS = {
  expense: '--error',
  axis: '--on-surface-variant',
  grid: '--outline-variant',
  surface: '--surface-container',
  onSurface: '--on-surface',
  outline: '--outline-variant',
} as const;

const EMPTY_COLORS: ChartColors = {
  expense: '',
  axis: '',
  grid: '',
  surface: '',
  onSurface: '',
  outline: '',
};

export const resolveChartColors = (readToken: (token: string) => string): ChartColors => ({
  expense: readToken(CHART_COLOR_TOKENS.expense),
  axis: readToken(CHART_COLOR_TOKENS.axis),
  grid: readToken(CHART_COLOR_TOKENS.grid),
  surface: readToken(CHART_COLOR_TOKENS.surface),
  onSurface: readToken(CHART_COLOR_TOKENS.onSurface),
  outline: readToken(CHART_COLOR_TOKENS.outline),
});

export const checkHasChartColors = (colors: ChartColors): boolean => colors.expense !== '';

const readDocumentToken = (token: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(token).trim();

export const DashboardDailySpendingContent: FC<Props> = ({
  chartData,
  expenseName,
  currency,
  locale,
}) => {
  const [colors, setColors] = useState<ChartColors>(EMPTY_COLORS);

  useEffect(() => {
    const syncColors = () => {
      setColors(resolveChartColors(readDocumentToken));
    };

    syncColors();

    const observer = new MutationObserver(syncColors);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [THEME_ATTRIBUTE],
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  if (!checkHasChartColors(colors)) {
    return <div style={{ height: CHART_HEIGHT }} aria-hidden="true" />;
  }

  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <BarChart data={chartData}>
        <CartesianGrid vertical={false} stroke={colors.grid} strokeOpacity={GRID_OPACITY} />
        <XAxis dataKey="label" tick={{ fill: colors.axis }} stroke={colors.axis} />
        <YAxis tick={{ fill: colors.axis }} stroke={colors.axis} />
        <Tooltip
          formatter={(value, _name, item) => {
            const datum = item.payload;
            const rawAmount = datum?.amount;

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
        <Bar dataKey="value" name={expenseName} fill={colors.expense} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
};
