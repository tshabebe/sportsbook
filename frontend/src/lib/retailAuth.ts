const RETAIL_TOKEN_KEY = 'retailAuthToken';

export const getRetailToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(RETAIL_TOKEN_KEY);
};

export const setRetailToken = (token: string): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(RETAIL_TOKEN_KEY, token);
};

export const clearRetailToken = (): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(RETAIL_TOKEN_KEY);
};

