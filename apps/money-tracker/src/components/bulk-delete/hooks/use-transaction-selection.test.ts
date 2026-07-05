import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MAX_BULK_DELETE_IDS } from '@supertool/shared/constants/transaction-bulk';

import { useTransactionSelection } from './use-transaction-selection';

const OVER_CAP_EXTRA = 1;
const NONE_SELECTED = 0;
const ONE_SELECTED = 1;
const THREE_SELECTED = 3;

const buildIdList = (size: number): string[] =>
  Array.from({ length: size }, (_value, index) => `id-${String(index)}`);

describe('useTransactionSelection', () => {
  it('toggles an id into and out of the selection', () => {
    const onOverCap = vi.fn();
    const { result } = renderHook(() =>
      useTransactionSelection({ visibleIdList: ['a', 'b'], onOverCap }),
    );

    act(() => {
      result.current.handleToggleSelection('a');
    });
    expect(result.current.selectedIdSet.has('a')).toBe(true);
    expect(result.current.selectedCount).toBe(ONE_SELECTED);

    act(() => {
      result.current.handleToggleSelection('a');
    });
    expect(result.current.selectedIdSet.has('a')).toBe(false);
    expect(result.current.selectedCount).toBe(NONE_SELECTED);
  });

  it('selects and deselects all visible ids', () => {
    const onOverCap = vi.fn();
    const { result } = renderHook(() =>
      useTransactionSelection({ visibleIdList: ['a', 'b', 'c'], onOverCap }),
    );

    act(() => {
      result.current.handleSelectAllVisible();
    });
    expect(result.current.areAllVisibleSelected).toBe(true);
    expect(result.current.selectedCount).toBe(THREE_SELECTED);

    act(() => {
      result.current.handleSelectAllVisible();
    });
    expect(result.current.areAllVisibleSelected).toBe(false);
    expect(result.current.selectedCount).toBe(NONE_SELECTED);
  });

  it('clears the selection', () => {
    const onOverCap = vi.fn();
    const { result } = renderHook(() =>
      useTransactionSelection({ visibleIdList: ['a', 'b'], onOverCap }),
    );

    act(() => {
      result.current.handleToggleSelection('a');
      result.current.handleClearSelection();
    });

    expect(result.current.selectedCount).toBe(NONE_SELECTED);
  });

  it('caps select-all-visible at the maximum and notifies over cap', () => {
    const onOverCap = vi.fn();
    const overCapList = buildIdList(MAX_BULK_DELETE_IDS + OVER_CAP_EXTRA);
    const { result } = renderHook(() =>
      useTransactionSelection({ visibleIdList: overCapList, onOverCap }),
    );

    act(() => {
      result.current.handleSelectAllVisible();
    });

    expect(result.current.selectedCount).toBe(MAX_BULK_DELETE_IDS);
    expect(onOverCap).toHaveBeenCalled();
  });

  it('rejects toggling a new id once the cap is reached', () => {
    const onOverCap = vi.fn();
    const cappedList = buildIdList(MAX_BULK_DELETE_IDS);
    const extraId = 'extra-id';
    const { result } = renderHook(() =>
      useTransactionSelection({
        visibleIdList: [...cappedList, extraId],
        onOverCap,
      }),
    );

    act(() => {
      result.current.handleSelectAllVisible();
    });
    act(() => {
      result.current.handleToggleSelection(extraId);
    });

    expect(result.current.selectedCount).toBe(MAX_BULK_DELETE_IDS);
    expect(result.current.selectedIdSet.has(extraId)).toBe(false);
    expect(onOverCap).toHaveBeenCalled();
  });
});
