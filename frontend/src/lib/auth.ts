const AUTH_TOKEN_KEY = 'authToken';

export const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
};

export const setAuthToken = (token: string): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(AUTH_TOKEN_KEY, token);
};

export const bootstrapAuthTokenFromUrl = (): string | null => {
  if (typeof window === 'undefined') return null;

  const url = new URL(window.location.href);
  const tokenFromUrl = url.searchParams.get('token');
  if (!tokenFromUrl) return getAuthToken();

  setAuthToken(tokenFromUrl);

  // Clean token from URL after persisting.
  url.searchParams.delete('token');
  const cleaned = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState({}, document.title, cleaned);

  return tokenFromUrl;
};

