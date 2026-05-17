import nodemailer from 'nodemailer';
import { loadEnv } from '../../config/env.js';
import { logger } from '../lib/logger.js';

const env = loadEnv();

let transporter: nodemailer.Transporter | null = null;

async function getTransporter() {
  if (transporter) return transporter;

  if (env.SMTP_HOST && env.SMTP_USER) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT ?? 587,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    });
  } else {
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
    logger.info({ user: testAccount.user }, 'Using Ethereal test SMTP');
  }
  return transporter;
}

export async function sendEmail(to: string, subject: string, html: string) {
  if (env.NODE_ENV === 'test') {
    logger.debug({ to, subject }, 'Email skipped in test');
    return { messageId: 'test' };
  }

  const transport = await getTransporter();
  const info = await transport.sendMail({
    from: env.SMTP_FROM,
    to,
    subject,
    html,
  });
  const preview = nodemailer.getTestMessageUrl(info);
  if (preview) logger.info({ preview }, 'Email preview URL');
  return info;
}
