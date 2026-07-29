import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST ?? '';
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 587);
const SMTP_USER = process.env.SMTP_USER ?? '';
const SMTP_PASS = process.env.SMTP_PASS ?? '';
const SMTP_FROM = process.env.SMTP_FROM ?? 'Springfield Systems <no-reply@springfieldsystems.com>';

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return null;
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return transporter;
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail({ to, subject, html, text }: EmailOptions) {
  const mailer = getTransporter();
  if (!mailer) {
    console.warn('Email not configured. SMTP details missing.');
    return { success: false, message: 'Email service is not configured.' };
  }

  try {
    const info = await mailer.sendMail({ from: SMTP_FROM, to, subject, html, text });
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error('Email send failed:', error);
    return { success: false, message: error.message ?? 'Failed to send email.' };
  }
}

export function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}
