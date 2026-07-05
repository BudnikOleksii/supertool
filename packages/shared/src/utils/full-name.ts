export const composeFullName = (firstName?: string | null, lastName?: string | null): string =>
  [firstName, lastName].filter(Boolean).join(' ').trim();

export const splitFullName = (name: string): { firstName: string; lastName: string | null } => {
  const [firstName = '', ...restList] = name.trim().split(' ');
  const lastName = restList.join(' ').trim();

  return { firstName, lastName: lastName === '' ? null : lastName };
};
