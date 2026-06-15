export const ROUTES = {
  home: '/',
  signIn: '/sign-in',
  signUp: '/sign-up',
  settings: '/settings',
  categories: '/categories',
  categoriesNew: '/categories/new',
  transactions: '/transactions',
} as const;

export const getCategoryEditPath = (id: string): string => `${ROUTES.categories}/${id}/edit`;
