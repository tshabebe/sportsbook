import type { NextFunction, Request, Response } from 'express';
import { toErrorPayload } from '../lib/http';

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    ok: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route not found: ${req.method} ${req.originalUrl}`,
    },
  });
};

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const { status, body } = toErrorPayload(err);
  console.error(
    JSON.stringify({
      level: 'error',
      requestId: res.locals.requestId,
      method: req.method,
      path: req.originalUrl,
      status,
      error: body.error,
    }),
  );
  res.status(status).json(body);
};

