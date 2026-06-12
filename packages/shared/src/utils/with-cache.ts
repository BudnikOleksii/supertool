export const withCache = <TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
): ((...args: TArgs) => Promise<TResult>) => {
  const cache = new Map<string, Promise<TResult>>();

  return (...args: TArgs): Promise<TResult> => {
    const key = JSON.stringify(args);

    const cached = cache.get(key);

    if (cached) {
      return cached;
    }

    const inFlight = fn(...args).catch((error) => {
      cache.delete(key);
      throw error;
    });

    cache.set(key, inFlight);

    return inFlight;
  };
};
