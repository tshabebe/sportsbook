import { Router, Request, Response } from 'express';
import { walletClient } from '../services/walletClient';
import { walletDebitSchema, walletCreditSchema } from '../validation/wallet';

export const router = Router();

const extractToken = (req: Request): string | null => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim();
};

router.get('/profile', async (req: Request, res: Response) => {
  try {
    const token = extractToken(req);
    if (!token) {
      res.status(401).json({ ok: false, error: 'Missing Bearer token' });
      return;
    }
    const data = await walletClient.getProfile(token);
    res.json({ ok: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ ok: false, error: message });
  }
});

router.post('/debit', async (req: Request, res: Response) => {
  try {
    const token = extractToken(req);
    if (!token) {
      res.status(401).json({ ok: false, error: 'Missing Bearer token' });
      return;
    }
    const parsed = walletDebitSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'Invalid payload', details: parsed.error.flatten() });
      return;
    }
    const result = await walletClient.debit(token, parsed.data);
    res.json({ ok: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ ok: false, error: message });
  }
});

router.post('/credit', async (req: Request, res: Response) => {
  try {
    const token = extractToken(req);
    if (!token) {
      res.status(401).json({ ok: false, error: 'Missing Bearer token' });
      return;
    }
    const parsed = walletCreditSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'Invalid payload', details: parsed.error.flatten() });
      return;
    }
    const result = await walletClient.credit(token, parsed.data);
    res.json({ ok: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ ok: false, error: message });
  }
});
