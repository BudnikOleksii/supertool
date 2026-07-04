import { CURRENCY_CODE_LIST } from '@supertool/shared/constants/currency';
import type { ComboboxOption } from '@supertool/ui/src/components/molecules/combobox/Combobox';

export const CURRENCY_OPTION_LIST: ComboboxOption[] = CURRENCY_CODE_LIST.map((code) => ({
  value: code,
  label: code,
}));
