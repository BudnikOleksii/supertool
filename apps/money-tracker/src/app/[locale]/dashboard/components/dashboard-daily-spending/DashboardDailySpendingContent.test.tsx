import { describe, expect, it } from 'vitest';

import { checkHasChartColors, resolveChartColors } from './DashboardDailySpendingContent';

const LIGHT_PALETTE: Record<string, string> = {
  '--error': '#b3261e',
  '--on-surface-variant': '#49454f',
  '--outline-variant': '#cac4d0',
  '--surface-container': '#f3edf7',
  '--on-surface': '#1d1b20',
};

const DARK_PALETTE: Record<string, string> = {
  '--error': '#f2b8b5',
  '--on-surface-variant': '#cac4d0',
  '--outline-variant': '#49454f',
  '--surface-container': '#211f26',
  '--on-surface': '#e6e0e9',
};

const readFrom =
  (palette: Record<string, string>) =>
  (token: string): string =>
    palette[token] ?? '';

describe('resolveChartColors', () => {
  it('maps every chart color to its design token value', () => {
    const colors = resolveChartColors(readFrom(DARK_PALETTE));

    expect(colors).toEqual({
      expense: '#f2b8b5',
      axis: '#cac4d0',
      grid: '#49454f',
      surface: '#211f26',
      onSurface: '#e6e0e9',
      outline: '#49454f',
    });
  });

  it('reflects the active theme palette on each read so a theme change yields new colors', () => {
    const light = resolveChartColors(readFrom(LIGHT_PALETTE));
    const dark = resolveChartColors(readFrom(DARK_PALETTE));

    expect(light.expense).toBe('#b3261e');
    expect(dark.expense).toBe('#f2b8b5');
    expect(light.expense).not.toBe(dark.expense);
  });
});

describe('checkHasChartColors', () => {
  it('returns false while tokens are unresolved so the chart shows its placeholder', () => {
    expect(checkHasChartColors(resolveChartColors(() => ''))).toBe(false);
  });

  it('returns true once the expense token resolves', () => {
    expect(checkHasChartColors(resolveChartColors(readFrom(DARK_PALETTE)))).toBe(true);
  });
});
