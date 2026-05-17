import { describe, it, expect } from 'vitest';
import { hashPassword, comparePassword, generateToken } from '../../src/shared/utils/password.js';

describe('password utils', () => {
  it('hashes and verifies password', async () => {
    const hash = await hashPassword('secret123');
    expect(await comparePassword('secret123', hash)).toBe(true);
    expect(await comparePassword('wrong', hash)).toBe(false);
  });

  it('generates unique tokens', () => {
    expect(generateToken()).not.toBe(generateToken());
  });
});
