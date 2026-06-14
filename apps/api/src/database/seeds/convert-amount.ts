import Decimal from 'decimal.js';

const MONEY_SCALE = 2;

export const convertAmountToString = (amount: number): string =>
  new Decimal(amount).toFixed(MONEY_SCALE);
