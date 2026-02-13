const ADMIN_TOKEN_KEY = 'adminAuthToken';

export const getAdminToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ADMIN_TOKEN_KEY);
};

export const setAdminToken = (token: string): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
};

export const clearAdminToken = (): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ADMIN_TOKEN_KEY);
};
