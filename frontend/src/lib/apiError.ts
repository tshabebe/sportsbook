import { AxiosError } from 'axios';

type ApiErrorPayload = {
  error?: {
    message?: string;
  };
};

export const getApiErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof AxiosError) {
    const payload = error.response?.data as ApiErrorPayload | undefined;
    return payload?.error?.message ?? fallback;
  }
  return fallback;
};
