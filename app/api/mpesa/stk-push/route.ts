import { NextRequest, NextResponse } from 'next/server';

const consumerKey = process.env.MPESA_CONSUMER_KEY ?? '';
const consumerSecret = process.env.MPESA_CONSUMER_SECRET ?? '';
const passkey = process.env.MPESA_PASSKEY ?? '';
const shortCode = process.env.MPESA_SHORTCODE ?? '';
const environment = process.env.MPESA_ENVIRONMENT ?? 'sandbox';

function decodeJWT(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    let payload = parts[1];
    payload = payload.replace(/-/g, '+').replace(/_/g, '/');
    while (payload.length % 4) payload += '=';
    try {
      return JSON.parse(atob(payload));
    } catch {
      return JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
    }
  } catch {
    return null;
  }
}

async function getAccessToken(): Promise<string> {
  const baseUrl = environment === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox-api.safaricom.co.ke';

  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  const response = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` }
  });

  if (!response.ok) {
    throw new Error('Failed to get M-Pesa access token');
  }

  const data = await response.json();
  return data.access_token;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, amount, accountReference, transactionDesc } = body;

    if (!phone || !amount) {
      return NextResponse.json({ message: 'Phone and amount required' }, { status: 400 });
    }

    const authorization = request.headers.get('authorization') ?? request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const accessToken = await getAccessToken();

    const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
    const password = Buffer.from(`${shortCode}${passkey}${timestamp}`).toString('base64');

    const baseUrl = environment === 'production'
      ? 'https://api.safaricom.co.ke'
      : 'https://sandbox-api.safaricom.co.ke';

    const response = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        BusinessShortCode: shortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(amount),
        PartyA: phone,
        PartyB: shortCode,
        PhoneNumber: phone,
        CallBackURL: `${process.env.NEXT_PUBLIC_APP_URL}/api/mpesa/callback`,
        AccountReference: accountReference || 'SPRINGFIELD',
        TransactionDesc: transactionDesc || 'Rent Payment'
      })
    });

    const result = await response.json();

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ message: error.message ?? 'Payment initiation failed' }, { status: 500 });
  }
}