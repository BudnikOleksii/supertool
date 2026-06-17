import { fetchLatestTransactionDate } from '../actions/fetch-latest-transaction-date';
import {
  checkIsValidPeriod,
  formatPeriod,
  getCurrentPeriod,
  getPeriodFromDate,
  parsePeriod,
} from './period';

export const resolveDefaultPeriod = async (rawPeriod: string | undefined): Promise<string> => {
  if (rawPeriod !== undefined && checkIsValidPeriod(rawPeriod)) {
    return formatPeriod(parsePeriod(rawPeriod));
  }

  const latestDate = await fetchLatestTransactionDate();

  if (latestDate === null) {
    return getCurrentPeriod();
  }

  const latestPeriod = getPeriodFromDate(latestDate);
  const currentPeriod = getCurrentPeriod();

  return latestPeriod < currentPeriod ? latestPeriod : currentPeriod;
};
