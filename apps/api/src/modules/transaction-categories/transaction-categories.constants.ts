import type { TransactionType } from '../../database/schemas/enums';

interface DefaultCategoryDefinition {
  name: string;
  type: TransactionType;
  childList: readonly string[];
}

export const DEFAULT_CATEGORY_CATALOG: readonly DefaultCategoryDefinition[] = [
  { name: 'Allowance', type: 'income', childList: [] },
  { name: 'Salary', type: 'income', childList: [] },
  { name: 'Petty cash', type: 'income', childList: [] },
  { name: 'Bonus', type: 'income', childList: [] },
  { name: 'Other', type: 'income', childList: [] },
  { name: 'Food', type: 'expense', childList: ['Groceries', 'Eating out', 'Beverages'] },
  {
    name: 'Social Life',
    type: 'expense',
    childList: ['Friends', 'Fellowship', 'Alumni', 'Dues'],
  },
  { name: 'Pets', type: 'expense', childList: [] },
  { name: 'Transport', type: 'expense', childList: ['Bus', 'Subway', 'Taxi', 'Car'] },
  { name: 'Culture', type: 'expense', childList: ['Books', 'Movie', 'Music', 'Apps'] },
  { name: 'General', type: 'expense', childList: ['Rent', 'Utilities'] },
  {
    name: 'Household',
    type: 'expense',
    childList: ['Appliances', 'Furniture', 'Kitchen', 'Toiletries', 'Chandlery'],
  },
  {
    name: 'Apparel',
    type: 'expense',
    childList: ['Clothing', 'Fashion', 'Shoes', 'Laundry'],
  },
  {
    name: 'Beauty',
    type: 'expense',
    childList: ['Cosmetics', 'Makeup', 'Accessories', 'Other'],
  },
  { name: 'Health', type: 'expense', childList: ['Medicine', 'Hospital', 'Other'] },
  {
    name: 'Education',
    type: 'expense',
    childList: ['Courses', 'Academy', 'Conferences', 'School supplies'],
  },
  { name: 'Gifts', type: 'expense', childList: ['Birthdays', 'Holidays'] },
  { name: 'Other', type: 'expense', childList: [] },
] as const;
