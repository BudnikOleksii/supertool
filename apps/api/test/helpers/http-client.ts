interface HttpClient {
  readJson: <T>(response: Response) => Promise<T>;
  getJson: (path: string, cookie?: string) => Promise<Response>;
  postJson: (path: string, body: unknown, cookie?: string) => Promise<Response>;
  patchJson: (path: string, body: unknown, cookie?: string) => Promise<Response>;
  deleteJson: (path: string, body: unknown, cookie?: string) => Promise<Response>;
}

const buildHeaders = (cookie?: string): Record<string, string> => ({
  'Content-Type': 'application/json',
  ...(cookie === undefined ? {} : { Cookie: cookie }),
});

export const createHttpClient = (getBaseUrl: () => string): HttpClient => {
  const sendWithBody =
    (method: string) =>
    async (path: string, body: unknown, cookie?: string): Promise<Response> =>
      fetch(`${getBaseUrl()}${path}`, {
        method,
        headers: buildHeaders(cookie),
        body: JSON.stringify(body),
      });

  return {
    readJson: async <T>(response: Response): Promise<T> => (await response.json()) as T,
    getJson: async (path: string, cookie?: string): Promise<Response> =>
      fetch(`${getBaseUrl()}${path}`, {
        headers: cookie === undefined ? {} : { Cookie: cookie },
      }),
    postJson: sendWithBody('POST'),
    patchJson: sendWithBody('PATCH'),
    deleteJson: sendWithBody('DELETE'),
  };
};
