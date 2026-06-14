'use server';

import { fetchProfile } from './fetch-profile';

export const fetchSignedInLocale = async (): Promise<string | null> => {
  const profile = await fetchProfile();

  return profile?.locale ?? null;
};
