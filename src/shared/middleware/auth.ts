import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../../shared/utils/jwt.js';
import { AppError } from '../../shared/errors/AppError.js';

export interface AuthRequest extends Request {
  user?: { id: string; email: string };
}

export function authenticate(req: AuthRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(AppError.unauthorized('Missing access token'));
  }
  try {
    const token = header.slice(7);
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch {
    next(AppError.unauthorized('Invalid access token'));
  }
}
