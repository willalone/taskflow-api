import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { loadEnv } from '../../config/env.js';

export async function hashPassword(password: string): Promise<string> {
  const { BCRYPT_ROUNDS } = loadEnv();
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
