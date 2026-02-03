import type { Request } from 'express';

export const normalizeQuery = (
  query: Request['query'],
): Record<string, string> => {
  const normalized: Record<string, string> = {};
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined) return;
    if (Array.isArray(value)) {
      normalized[key] = value[0] !== undefined ? String(value[0]) : '';
      return;
    }
    normalized[key] = String(value);
  });
  return normalized;
};
