import { Router, Request, Response } from 'express';
import { walletClient } from '../services/walletClient';
import { walletDebitSchema, walletCreditSchema } from '../validation/wallet';
import { asyncHandler } from '../middleware/asyncHandler';
import { HttpError } from '../lib/http';
import { requireBearerToken } from './utils';

export const router = Router();

router.get(
  '/profile',
  asyncHandler(async (req: Request, res: Response) => {
    const token = requireBearerToken(req);
    const data = await walletClient.getProfile(token);
    res.json({ ok: true, data });
  }),
);

router.post(
  '/debit',
  asyncHandler(async (req: Request, res: Response) => {
    const token = requireBearerToken(req);
    const parsed = walletDebitSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'INVALID_PAYLOAD', 'Invalid payload', parsed.error.flatten());
    }
    const result = await walletClient.debit(token, parsed.data);
    res.json({ ok: true, data: result });
  }),
);

router.post(
  '/credit',
  asyncHandler(async (req: Request, res: Response) => {
    const token = requireBearerToken(req);
    const parsed = walletCreditSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'INVALID_PAYLOAD', 'Invalid payload', parsed.error.flatten());
    }
    const result = await walletClient.credit(token, parsed.data);
    res.json({ ok: true, data: result });
  }),
);
