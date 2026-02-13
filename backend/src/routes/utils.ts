import type { Request } from 'express';
import { HttpError } from '../lib/http';
import { verifyRetailToken } from '../services/retailAuth';
import { verifyAdminToken } from '../services/adminAuth';

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

export const extractBearerToken = (req: Request): string | null => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim();
};

export const requireBearerToken = (req: Request): string => {
  const token = extractBearerToken(req);
  if (!token) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Missing Bearer token');
  }
  return token;
};

export const requireRetailerToken = (
  req: Request,
): { retailerId: number; username: string; exp: number } => {
  const token = requireBearerToken(req);
  return verifyRetailToken(token);
};

export const requireAdminToken = (
  req: Request,
): { role: 'admin'; username: string; exp: number } => {
  const token = requireBearerToken(req);
  return verifyAdminToken(token);
};
