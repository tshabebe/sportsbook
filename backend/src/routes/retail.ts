import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { HttpError } from '../lib/http';
import {
  findRetailerByUsername,
  getRetailTicketByTicketId,
  claimRetailTicket,
  listRetailTicketsByRetailer,
  payoutRetailTicket,
} from '../services/db';
import {
  retailerLoginSchema,
  retailListQuerySchema,
  retailPayoutSchema,
  retailTicketParamsSchema,
} from '../validation/retail';
import { createRetailToken, verifyRetailerPassword } from '../services/retailAuth';
import { requireRetailerToken } from './utils';

export const router = Router();

router.post(
  '/auth/login',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = retailerLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'INVALID_LOGIN_PAYLOAD', 'Invalid retailer login payload');
    }

    const retailer = await findRetailerByUsername(parsed.data.username);
    if (!retailer || !retailer.isActive) {
      throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid retailer credentials');
    }
    const ok = verifyRetailerPassword(parsed.data.password, retailer.passwordHash);
    if (!ok) {
      throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid retailer credentials');
    }

    const token = createRetailToken(retailer.id, retailer.username);
    res.json({
      ok: true,
      token,
      retailer: {
        id: retailer.id,
        name: retailer.name,
        username: retailer.username,
      },
    });
  }),
);

router.get(
  '/tickets/:ticketId',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = retailTicketParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      throw new HttpError(400, 'INVALID_TICKET_ID', 'Invalid ticket id');
    }
    const ticket = await getRetailTicketByTicketId(parsed.data.ticketId);
    if (!ticket) {
      throw new HttpError(404, 'TICKET_NOT_FOUND', 'Ticket not found');
    }
    res.json({ ok: true, ticket });
  }),
);

router.post(
  '/tickets/:ticketId/claim',
  asyncHandler(async (req: Request, res: Response) => {
    const auth = requireRetailerToken(req);
    const parsed = retailTicketParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      throw new HttpError(400, 'INVALID_TICKET_ID', 'Invalid ticket id');
    }

    const claimed = await claimRetailTicket(parsed.data.ticketId, auth.retailerId);
    if (!claimed) {
      const ticket = await getRetailTicketByTicketId(parsed.data.ticketId);
      if (!ticket) {
        throw new HttpError(404, 'TICKET_NOT_FOUND', 'Ticket not found');
      }
      if (ticket.claimedByRetailerId && ticket.claimedByRetailerId !== auth.retailerId) {
        throw new HttpError(409, 'TICKET_ALREADY_CLAIMED', 'Ticket already claimed by another retailer');
      }
      throw new HttpError(409, 'TICKET_NOT_CLAIMABLE', `Ticket cannot be claimed in status ${ticket.status}`);
    }
    res.json({ ok: true, ticket: claimed });
  }),
);

router.post(
  '/tickets/:ticketId/payout',
  asyncHandler(async (req: Request, res: Response) => {
    const auth = requireRetailerToken(req);
    const params = retailTicketParamsSchema.safeParse(req.params);
    if (!params.success) {
      throw new HttpError(400, 'INVALID_TICKET_ID', 'Invalid ticket id');
    }
    const body = retailPayoutSchema.safeParse(req.body);
    if (!body.success) {
      throw new HttpError(400, 'INVALID_PAYOUT_PAYLOAD', 'Invalid payout payload');
    }

    const result = await payoutRetailTicket({
      ticketId: params.data.ticketId,
      retailerId: auth.retailerId,
      payoutReference: body.data.payoutReference,
    });

    if (result.code === 'NOT_FOUND') {
      throw new HttpError(404, 'TICKET_NOT_FOUND', 'Ticket not found');
    }
    if (result.code === 'ALREADY_PAID') {
      res.json({ ok: true, ticket: result.ticket, idempotent: true });
      return;
    }
    if (result.code === 'NOT_OWNER') {
      throw new HttpError(403, 'TICKET_NOT_OWNED', 'Ticket is owned by another retailer');
    }
    if (result.code === 'NOT_SETTLED_FOR_PAYOUT') {
      throw new HttpError(409, 'TICKET_NOT_PAYABLE', 'Ticket is not ready for payout');
    }
    if (result.code === 'CONFLICT') {
      throw new HttpError(409, 'PAYOUT_CONFLICT', 'Ticket payout conflict');
    }

    res.json({ ok: true, ticket: result.ticket });
  }),
);

router.get(
  '/my/tickets',
  asyncHandler(async (req: Request, res: Response) => {
    const auth = requireRetailerToken(req);
    const parsed = retailListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new HttpError(400, 'INVALID_QUERY', 'Invalid retail ticket query');
    }
    const tickets = await listRetailTicketsByRetailer(auth.retailerId, parsed.data.status);
    res.json({ ok: true, tickets });
  }),
);

