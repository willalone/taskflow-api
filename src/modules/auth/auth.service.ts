import { prisma } from '../../shared/lib/prisma.js';
import { redis, REFRESH_BLACKLIST_PREFIX } from '../../shared/lib/redis.js';
import { AppError } from '../../shared/errors/AppError.js';
import { comparePassword, generateToken, hashPassword } from '../../shared/utils/password.js';
import {
  parseExpiresInMs,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../../shared/utils/jwt.js';
import { loadEnv } from '../../config/env.js';
import { sendEmail } from '../../shared/services/email.service.js';

const env = loadEnv();

export class AuthService {
  async register(email: string, password: string, name: string) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw AppError.conflict('Email already registered');

    const verifyToken = generateToken();
    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash: await hashPassword(password),
        emailVerifyToken: verifyToken,
        isActive: false,
      },
      select: { id: true, email: true, name: true, isActive: true, createdAt: true },
    });

    const verifyUrl = `${env.APP_URL}/api/v1/auth/verify-email?token=${verifyToken}`;
    await sendEmail(
      email,
      'Verify your TaskFlow email',
      `<p>Hi ${name},</p><p><a href="${verifyUrl}">Verify email</a></p>`,
    );

    return user;
  }

  async verifyEmail(token: string) {
    const user = await prisma.user.findFirst({ where: { emailVerifyToken: token } });
    if (!user) throw AppError.badRequest('Invalid verification token');
    await prisma.user.update({
      where: { id: user.id },
      data: { isActive: true, emailVerifyToken: null },
    });
    return { verified: true };
  }

  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await comparePassword(password, user.passwordHash))) {
      throw AppError.unauthorized('Invalid credentials');
    }
    if (!user.isActive) throw AppError.forbidden('Account not activated. Verify your email.');

    return this.issueTokens(user.id, user.email);
  }

  async issueTokens(userId: string, email: string) {
    const jti = generateToken();
    const refreshToken = signRefreshToken(userId, jti);
    const expiresAt = new Date(Date.now() + parseExpiresInMs(env.JWT_REFRESH_EXPIRES_IN));

    await prisma.refreshToken.create({
      data: { token: jti, userId, expiresAt },
    });

    return {
      accessToken: signAccessToken(userId, email),
      refreshToken,
    };
  }

  async refresh(refreshToken: string) {
    const blacklisted = await redis.get(`${REFRESH_BLACKLIST_PREFIX}${refreshToken}`);
    if (blacklisted) throw AppError.unauthorized('Token revoked');

    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw AppError.unauthorized('Invalid refresh token');
    }

    const stored = await prisma.refreshToken.findUnique({ where: { token: payload.jti } });
    if (!stored || stored.revoked || stored.expiresAt < new Date()) {
      throw AppError.unauthorized('Refresh token expired or revoked');
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) throw AppError.unauthorized('User not found or inactive');

    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revoked: true },
    });

    return this.issueTokens(user.id, user.email);
  }

  async logout(refreshToken: string) {
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      return { success: true };
    }

    await prisma.refreshToken.updateMany({
      where: { token: payload.jti },
      data: { revoked: true },
    });
    const ttl = parseExpiresInMs(env.JWT_REFRESH_EXPIRES_IN);
    await redis.set(`${REFRESH_BLACKLIST_PREFIX}${refreshToken}`, '1', 'PX', ttl);
    return { success: true };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(await comparePassword(currentPassword, user.passwordHash))) {
      throw AppError.badRequest('Current password is incorrect');
    }
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(newPassword) },
    });
    await prisma.refreshToken.updateMany({
      where: { userId },
      data: { revoked: true },
    });
    return { success: true };
  }

  async requestPasswordReset(email: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return { sent: true };

    const token = generateToken();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: token,
        passwordResetExpires: new Date(Date.now() + 3600_000),
      },
    });

    const resetUrl = `${env.APP_URL}/api/v1/auth/reset-password?token=${token}`;
    await sendEmail(email, 'Reset your TaskFlow password', `<p><a href="${resetUrl}">Reset password</a></p>`);
    return { sent: true };
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: { gt: new Date() },
      },
    });
    if (!user) throw AppError.badRequest('Invalid or expired reset token');

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(newPassword),
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });
    await prisma.refreshToken.updateMany({
      where: { userId: user.id },
      data: { revoked: true },
    });
    return { success: true };
  }
}
