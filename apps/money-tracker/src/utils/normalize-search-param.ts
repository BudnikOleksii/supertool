const FIRST_ELEMENT_INDEX = 0;

export const normalizeSearchParam = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[FIRST_ELEMENT_INDEX] : value;
