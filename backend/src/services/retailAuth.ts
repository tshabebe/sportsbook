import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { config } from './config';
import { HttpError } from '../lib/http';

const TOKEN_TTL_SECONDS = 60 * 60 * 12; // 12h

type RetailTokenPayload = {
  retailerId: number;
  username: string;
  exp: number;
};

const toBase64Url = (value: string) =>
  Buffer.from(value, 'utf8').toString('base64url');

const fromBase64Url = (value: string) =>
  Buffer.from(value, 'base64url').toString('utf8');

const sign = (input: string): string =>
  createHmac('sha256', config.retailAuthSecret).update(input).digest('base64url');

export const createRetailToken = (retailerId: number, username: string): string => {
  const payload: RetailTokenPayload = {
    retailerId,
    username,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  };
  const encoded = toBase64Url(JSON.stringify(payload));
  const signature = sign(encoded);
  return `${encoded}.${signature}`;
};

export const verifyRetailToken = (token: string): RetailTokenPayload => {
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) {
    throw new HttpError(401, 'INVALID_RETAIL_TOKEN', 'Malformed retailer token');
  }
  const expectedSignature = sign(encoded);
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (
    sigBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(sigBuffer, expectedBuffer)
  ) {
    throw new HttpError(401, 'INVALID_RETAIL_TOKEN', 'Invalid retailer token signature');
  }

  let payload: RetailTokenPayload;
  try {
    payload = JSON.parse(fromBase64Url(encoded)) as RetailTokenPayload;
  } catch {
    throw new HttpError(401, 'INVALID_RETAIL_TOKEN', 'Invalid retailer token payload');
  }

  if (!payload?.retailerId || !payload?.username || !payload?.exp) {
    throw new HttpError(401, 'INVALID_RETAIL_TOKEN', 'Retail token missing fields');
  }
  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new HttpError(401, 'INVALID_RETAIL_TOKEN', 'Retail token expired');
  }
  return payload;
};

export const verifyRetailerPassword = (
  providedPassword: string,
  storedPasswordHash: string,
): boolean => {
  if (storedPasswordHash.startsWith('plain:')) {
    return storedPasswordHash.slice('plain:'.length) === providedPassword;
  }

  if (storedPasswordHash.startsWith('scrypt:')) {
    const [, saltHex, hashHex] = storedPasswordHash.split(':');
    if (!saltHex || !hashHex) return false;
    const derived = scryptSync(providedPassword, Buffer.from(saltHex, 'hex'), 64);
    const actual = Buffer.from(hashHex, 'hex');
    if (derived.length !== actual.length) return false;
    return timingSafeEqual(derived, actual);
  }

  return false;
};

export const createRetailerPasswordHash = (password: string): string => {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`;
};

export type { RetailTokenPayload };

