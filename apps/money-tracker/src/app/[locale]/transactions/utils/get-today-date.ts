const MONTH_OFFSET = 1;
const DATE_PART_LENGTH = 2;
const DATE_PAD_CHAR = '0';

export const getTodayDate = (): string => {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + MONTH_OFFSET).padStart(DATE_PART_LENGTH, DATE_PAD_CHAR);
  const day = String(now.getDate()).padStart(DATE_PART_LENGTH, DATE_PAD_CHAR);

  return `${year}-${month}-${day}`;
};
