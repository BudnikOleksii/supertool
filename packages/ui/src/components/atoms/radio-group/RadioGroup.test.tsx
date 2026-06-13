import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RadioGroup, RadioGroupItem } from './RadioGroup';

const RADIO_ITEM_COUNT = 2;

describe('RadioGroup', () => {
  it('renders each item with a radio role', () => {
    render(
      <RadioGroup defaultValue="income">
        <RadioGroupItem value="income">Income</RadioGroupItem>
        <RadioGroupItem value="expense">Expense</RadioGroupItem>
      </RadioGroup>,
    );

    expect(screen.getAllByRole('radio')).toHaveLength(RADIO_ITEM_COUNT);
  });

  it('selects an item on click', () => {
    render(
      <RadioGroup defaultValue="income">
        <RadioGroupItem value="income">Income</RadioGroupItem>
        <RadioGroupItem value="expense">Expense</RadioGroupItem>
      </RadioGroup>,
    );

    const expense = screen.getByRole('radio', { name: 'Expense' });

    expect(expense.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(expense);
    expect(expense.getAttribute('aria-checked')).toBe('true');
  });
});
