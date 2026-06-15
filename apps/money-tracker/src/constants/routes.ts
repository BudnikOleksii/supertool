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
} as const;

export const getCategoryEditPath = (id: string): string => `${ROUTES.categories}/${id}/edit`;

export const getTransactionEditPath = (id: string): string => `${ROUTES.transactions}/${id}/edit`;
