import { createHmac, timingSafeEqual } from 'crypto';
import { config } from './config';
import { HttpError } from '../lib/http';
import { verifyRetailerPassword } from './retailAuth';

const TOKEN_TTL_SECONDS = 60 * 60 * 12; // 12h

type AdminTokenPayload = {
  role: 'admin';
  username: string;
  exp: number;
};

const toBase64Url = (value: string) => Buffer.from(value, 'utf8').toString('base64url');
const fromBase64Url = (value: string) => Buffer.from(value, 'base64url').toString('utf8');

const sign = (input: string): string =>
  createHmac('sha256', config.adminAuthSecret).update(input).digest('base64url');

export const createAdminToken = (username: string): string => {
  const payload: AdminTokenPayload = {
    role: 'admin',
    username,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  };
  const encoded = toBase64Url(JSON.stringify(payload));
  const signature = sign(encoded);
  return `${encoded}.${signature}`;
};

export const verifyAdminToken = (token: string): AdminTokenPayload => {
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) {
    throw new HttpError(401, 'INVALID_ADMIN_TOKEN', 'Malformed admin token');
  }

  const expectedSignature = sign(encoded);
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (
    sigBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(sigBuffer, expectedBuffer)
  ) {
    throw new HttpError(401, 'INVALID_ADMIN_TOKEN', 'Invalid admin token signature');
  }

  let payload: AdminTokenPayload;
  try {
    payload = JSON.parse(fromBase64Url(encoded)) as AdminTokenPayload;
  } catch {
    throw new HttpError(401, 'INVALID_ADMIN_TOKEN', 'Invalid admin token payload');
  }

  if (payload?.role !== 'admin' || !payload?.username || !payload?.exp) {
    throw new HttpError(401, 'INVALID_ADMIN_TOKEN', 'Admin token missing fields');
  }

  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new HttpError(401, 'INVALID_ADMIN_TOKEN', 'Admin token expired');
  }

  return payload;
};

export const verifyAdminCredentials = (username: string, password: string): boolean => {
  const normalizedUsername = username.trim();
  if (normalizedUsername !== config.adminUsername) return false;
  return verifyRetailerPassword(password, config.adminPasswordHash);
};

export type { AdminTokenPayload };
