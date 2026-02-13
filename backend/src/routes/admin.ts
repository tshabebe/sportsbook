import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { HttpError } from '../lib/http';
import {
  createRetailer,
  expireRetailTickets,
  findRetailerByUsername,
  getRetailerById,
  listRetailers,
  listRetailersWithProfitSummary,
  listRetailSettleableTicketIdsByRetailer,
  updateRetailerActiveStatus,
  updateRetailerPasswordHash,
} from '../services/db';
import {
  adminCashierCreateSchema,
  adminCashierListQuerySchema,
  adminCashierParamsSchema,
  adminCashierPasswordSchema,
  adminCashierStatusSchema,
  adminLoginSchema,
} from '../validation/admin';
import { createAdminToken, verifyAdminCredentials } from '../services/adminAuth';
import { createRetailerPasswordHash } from '../services/retailAuth';
import { requireAdminToken, normalizeQuery } from './utils';
import { settleRetailTicketIfDecidable } from '../services/retailSettlement';

export const router = Router();

const SETTLEMENT_REFRESH_LIMIT = 60;

const refreshAllCashierTicketState = async (from: Date, to: Date) => {
  const cashiers = await listRetailers();
  for (const cashier of cashiers) {
    await expireRetailTickets({ retailerId: cashier.id });
    const ticketIds = await listRetailSettleableTicketIdsByRetailer({
      retailerId: cashier.id,
      from,
      to,
      limit: SETTLEMENT_REFRESH_LIMIT,
    });
    for (const ticketId of ticketIds) {
      try {
        await settleRetailTicketIfDecidable(ticketId);
      } catch (error) {
        console.error('Failed to refresh cashier ticket settlement', {
          cashierId: cashier.id,
          ticketId,
          error,
        });
      }
    }
  }
};

router.post(
  '/auth/login',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = adminLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'INVALID_LOGIN_PAYLOAD', 'Invalid admin login payload');
    }

    const ok = verifyAdminCredentials(parsed.data.username, parsed.data.password);
    if (!ok) {
      throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid admin credentials');
    }

    const username = parsed.data.username.trim();
    const token = createAdminToken(username);
    res.json({
      ok: true,
      token,
      admin: {
        username,
      },
    });
  }),
);

router.get(
  '/cashiers',
  asyncHandler(async (req: Request, res: Response) => {
    requireAdminToken(req);

    const parsed = adminCashierListQuerySchema.safeParse(normalizeQuery(req.query));
    if (!parsed.success) {
      throw new HttpError(400, 'INVALID_QUERY', 'Invalid cashier query');
    }

    const now = new Date();
    const to = parsed.data.to ?? now;
    const from = parsed.data.from ?? new Date(to.getTime() - 1000 * 60 * 60 * 24 * 7);

    await refreshAllCashierTicketState(from, to);

    const cashiers = await listRetailersWithProfitSummary({ from, to });
    const summary = cashiers.reduce(
      (acc, cashier) => ({
        totalStake: Number((acc.totalStake + cashier.totalStake).toFixed(2)),
        totalPaidOut: Number((acc.totalPaidOut + cashier.totalPaidOut).toFixed(2)),
        outstandingPayoutAmount: Number(
          (acc.outstandingPayoutAmount + cashier.outstandingPayoutAmount).toFixed(2),
        ),
        netProfit: Number((acc.netProfit + cashier.netProfit).toFixed(2)),
        ticketsCount: acc.ticketsCount + cashier.ticketsCount,
        paidTicketsCount: acc.paidTicketsCount + cashier.paidTicketsCount,
        outstandingTicketsCount:
          acc.outstandingTicketsCount + cashier.outstandingTicketsCount,
      }),
      {
        totalStake: 0,
        totalPaidOut: 0,
        outstandingPayoutAmount: 0,
        netProfit: 0,
        ticketsCount: 0,
        paidTicketsCount: 0,
        outstandingTicketsCount: 0,
      },
    );

    res.json({
      ok: true,
      range: {
        from: from.toISOString(),
        to: to.toISOString(),
      },
      summary,
      cashiers,
    });
  }),
);

router.post(
  '/cashiers',
  asyncHandler(async (req: Request, res: Response) => {
    requireAdminToken(req);

    const parsed = adminCashierCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'INVALID_CASHIER_PAYLOAD', 'Invalid cashier payload');
    }

    const username = parsed.data.username.trim();
    const name = parsed.data.name.trim();
    if (!username || !name) {
      throw new HttpError(400, 'INVALID_CASHIER_PAYLOAD', 'Cashier name/username is required');
    }

    const existing = await findRetailerByUsername(username);
    if (existing) {
      throw new HttpError(409, 'USERNAME_TAKEN', 'Cashier username already exists');
    }

    const created = await createRetailer({
      name,
      username,
      passwordHash: createRetailerPasswordHash(parsed.data.password),
      isActive: parsed.data.isActive ?? true,
    });

    res.status(201).json({
      ok: true,
      cashier: {
        id: created.id,
        name: created.name,
        username: created.username,
        isActive: created.isActive,
        createdAt: created.createdAt,
      },
    });
  }),
);

router.patch(
  '/cashiers/:cashierId/password',
  asyncHandler(async (req: Request, res: Response) => {
    requireAdminToken(req);

    const params = adminCashierParamsSchema.safeParse(req.params);
    if (!params.success) {
      throw new HttpError(400, 'INVALID_CASHIER_ID', 'Invalid cashier id');
    }
    const body = adminCashierPasswordSchema.safeParse(req.body);
    if (!body.success) {
      throw new HttpError(400, 'INVALID_PASSWORD_PAYLOAD', 'Invalid password payload');
    }

    const cashier = await getRetailerById(params.data.cashierId);
    if (!cashier) {
      throw new HttpError(404, 'CASHIER_NOT_FOUND', 'Cashier not found');
    }

    const updated = await updateRetailerPasswordHash(
      cashier.id,
      createRetailerPasswordHash(body.data.password),
    );
    if (!updated) {
      throw new HttpError(409, 'CASHIER_UPDATE_CONFLICT', 'Failed to update cashier password');
    }

    res.json({ ok: true });
  }),
);

router.patch(
  '/cashiers/:cashierId/status',
  asyncHandler(async (req: Request, res: Response) => {
    requireAdminToken(req);

    const params = adminCashierParamsSchema.safeParse(req.params);
    if (!params.success) {
      throw new HttpError(400, 'INVALID_CASHIER_ID', 'Invalid cashier id');
    }
    const body = adminCashierStatusSchema.safeParse(req.body);
    if (!body.success) {
      throw new HttpError(400, 'INVALID_STATUS_PAYLOAD', 'Invalid status payload');
    }

    const updated = await updateRetailerActiveStatus(
      params.data.cashierId,
      body.data.isActive,
    );
    if (!updated) {
      throw new HttpError(404, 'CASHIER_NOT_FOUND', 'Cashier not found');
    }

    res.json({
      ok: true,
      cashier: {
        id: updated.id,
        isActive: updated.isActive,
      },
    });
  }),
);
