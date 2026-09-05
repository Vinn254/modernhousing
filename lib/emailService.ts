import nodemailer from 'nodemailer';
import './consoleGuard';

const SMTP_HOST = process.env.SMTP_HOST ?? '';
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 587);
const SMTP_USER = process.env.SMTP_USER ?? '';
const SMTP_PASS = process.env.SMTP_PASS ?? '';
const SMTP_FROM = process.env.SMTP_FROM ?? 'Springfield Systems <no-reply@springfieldsystems.com>';

const BREVO_API_KEY = process.env.BREVO_API_KEY ?? '';
const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME ?? 'Springfield Systems';
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL ?? 'no-reply@springfieldsystems.com';

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
  if (BREVO_API_KEY) {
    return sendViaBrevo({ to, subject, html, text });
  }

  const mailer = getTransporter();
  if (!mailer) {
    console.warn('Email not configured. Set SMTP or BREVO_API_KEY environment variables.');
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

async function sendViaBrevo({ to, subject, html, text }: EmailOptions) {
  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: { name: BREVO_SENDER_NAME, email: BREVO_SENDER_EMAIL },
        to: [{ email: to }],
        subject,
        htmlContent: html,
        textContent: text ?? html.replace(/<[^>]*>/g, ''),
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Brevo email failed:', result);
      return { success: false, message: result.message ?? 'Failed to send email via Brevo.' };
    }

    return { success: true, messageId: result.messageId };
  } catch (error: any) {
    console.error('Brevo email error:', error);
    return { success: false, message: error.message ?? 'Failed to send email via Brevo.' };
  }
}

export function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}
