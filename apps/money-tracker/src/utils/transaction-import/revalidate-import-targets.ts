import { revalidatePath } from 'next/cache';

import { ROUTES } from '../../constants/routes';

export const revalidateImportTargets = (): void => {
  revalidatePath(ROUTES.transactions);
  revalidatePath(ROUTES.dashboard);
  revalidatePath(ROUTES.categories);
};
