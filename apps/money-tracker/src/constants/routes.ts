export const ROUTES = {
  home: '/',
  dashboard: '/dashboard',
  signIn: '/sign-in',
  signUp: '/sign-up',
  settings: '/settings',
  categories: '/categories',
  categoriesNew: '/categories/new',
  transactions: '/transactions',
  transactionsNew: '/transactions/new',
  transactionsByCategory: '/transactions/by-category',
  transactionsRecurring: '/transactions/recurring',
  transactionsImport: '/transactions/import',
} as const;

export const getCategoryEditPath = (id: string): string => `${ROUTES.categories}/${id}/edit`;

export const getTransactionEditPath = (id: string): string => `${ROUTES.transactions}/${id}/edit`;

export const COPY_FROM_SEARCH_PARAM = 'copyFrom';

export const getTransactionCopyPath = (id: string): string =>
  `${ROUTES.transactionsNew}?${COPY_FROM_SEARCH_PARAM}=${id}`;
