const BREVO_API_KEY = process.env.BREVO_API_KEY ?? '';
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL ?? 'noreply@springfield-systems.com';
const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME ?? 'Springfield Systems';
const BREVO_SMS_SENDER = process.env.BREVO_SMS_SENDER ?? '';
export async function sendEmailBrevo(to, subject, html) {
    if (!BREVO_API_KEY) {
        console.warn('BREVO_API_KEY not configured');
        return { success: false, error: 'Brevo API key not configured' };
    }
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
            'api-key': BREVO_API_KEY,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            sender: { email: BREVO_SENDER_EMAIL, name: BREVO_SENDER_NAME },
            to: [{ email: to }],
            subject,
            htmlContent: html,
        }),
    });
    const result = await response.json();
    return { success: response.ok, data: result, error: response.ok ? null : result.message || 'Failed to send email' };
}
export async function sendSMSBrevo(to, message) {
    if (!BREVO_API_KEY) {
        console.warn('BREVO_API_KEY not configured');
        return { success: false, error: 'Brevo API key not configured' };
    }
    const response = await fetch('https://api.brevo.com/v3/sms/send', {
        method: 'POST',
        headers: {
            'api-key': BREVO_API_KEY,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            sender: BREVO_SMS_SENDER,
            recipient: to,
            content: message,
        }),
    });
    const result = await response.json();
    return { success: response.ok, data: result, error: response.ok ? null : result.message || 'Failed to send SMS' };
}
