export interface TestUser {
  name: string;
  email: string;
  password: string;
}

interface AuthHttpClient {
  postJson: (path: string, body: unknown, cookie?: string) => Promise<Response>;
}

interface AuthClient {
  signUp: (user: TestUser) => Promise<Response>;
  signIn: (user: TestUser) => Promise<Response>;
  signInForCookie: (user: TestUser) => Promise<string>;
  registerAndSignIn: (user: TestUser) => Promise<string>;
}

export const buildTestUser = (suffix: string): TestUser => ({
  name: `User ${suffix}`,
  email: `${suffix}@example.com`,
  password: 'supersecret123',
});

export const extractSessionCookie = (response: Response): string => {
  const sessionCookie = response.headers
    .getSetCookie()
    .find((cookie) => cookie.startsWith('better-auth.session_token='));

  if (sessionCookie === undefined) {
    throw new Error('expected a better-auth session cookie in the response');
  }

  return sessionCookie.split(';')[0] ?? '';
};

export const createAuthClient = (client: AuthHttpClient): AuthClient => {
  const signUp = async (user: TestUser): Promise<Response> =>
    client.postJson('/api/v1/auth/sign-up/email', user);

  const signIn = async (user: TestUser): Promise<Response> =>
    client.postJson('/api/v1/auth/sign-in/email', {
      email: user.email,
      password: user.password,
    });

  const signInForCookie = async (user: TestUser): Promise<string> =>
    extractSessionCookie(await signIn(user));

  const registerAndSignIn = async (user: TestUser): Promise<string> => {
    await signUp(user);

    return signInForCookie(user);
  };

  return { signUp, signIn, signInForCookie, registerAndSignIn };
};
