import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import { validate } from '../../src/shared/middleware/validate.js';

describe('validate middleware', () => {
  it('replaces query on Express 5 read-only getter', () => {
    const schema = z.object({ page: z.coerce.number() });
    const middleware = validate(schema, 'query');

    const req = { query: { page: '2' } } as unknown as Request;
    const next = vi.fn();

    middleware(req, {} as Response, next as NextFunction);

    expect(next).toHaveBeenCalledWith();
    expect(req.query).toEqual({ page: 2 });
  });
});
