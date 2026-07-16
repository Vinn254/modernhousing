import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

const defaultConsumerKey = process.env.MPESA_CONSUMER_KEY ?? '';
const defaultConsumerSecret = process.env.MPESA_CONSUMER_SECRET ?? '';
const defaultPasskey = process.env.MPESA_PASSKEY ?? '';
const defaultShortCode = process.env.MPESA_SHORTCODE ?? '';
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

async function getTenantOrganizationId(tenantId: string, userEmail?: string): Promise<string | null> {
  // First try: get tenant's unit_id, then find property's organization_id
  const { data: tenantRow } = await supabaseAdmin
    .from('tenants')
    .select('unit_id')
    .eq('id', tenantId)
    .maybeSingle();
  
  if (tenantRow?.unit_id) {
    const { data: unitRow } = await supabaseAdmin
      .from('units')
      .select('property_id')
      .eq('id', tenantRow.unit_id)
      .maybeSingle();
    
    if (unitRow?.property_id) {
      const { data: propRow } = await supabaseAdmin
        .from('properties')
        .select('organization_id')
        .eq('id', unitRow.property_id)
        .maybeSingle();
      
      if (propRow?.organization_id) {
        return propRow.organization_id;
      }
    }
  }
  
  // Fallback: try by email if tenant not found by ID
  if (userEmail) {
    const { data: tenantByEmail } = await supabaseAdmin
      .from('tenants')
      .select('unit_id')
      .eq('email', userEmail)
      .maybeSingle();
    
    if (tenantByEmail?.unit_id) {
      const { data: unitRow } = await supabaseAdmin
        .from('units')
        .select('property_id')
        .eq('id', tenantByEmail.unit_id)
        .maybeSingle();
      
      if (unitRow?.property_id) {
        const { data: propRow } = await supabaseAdmin
          .from('properties')
          .select('organization_id')
          .eq('id', unitRow.property_id)
          .maybeSingle();
        
        if (propRow?.organization_id) {
          return propRow.organization_id;
        }
      }
    }
  }
  
  // Final fallback: try to find organization from any payment_settings if exists (for testing)
  const { data: anySettings } = await supabaseAdmin
    .from('payment_settings')
    .select('organization_id')
    .limit(1)
    .maybeSingle();
  
  return anySettings?.organization_id ?? null;
}

async function getOrganizationCredentials(organizationId: string | null) {
  if (!organizationId) {
    // Use any payment_settings credentials if defaults not set
    const { data: anySettings } = await supabaseAdmin
      .from('payment_settings')
      .select('consumer_key, consumer_secret, passkey, shortcode')
      .limit(1)
      .maybeSingle();
    
    return {
      consumerKey: anySettings?.consumer_key || defaultConsumerKey,
      consumerSecret: anySettings?.consumer_secret || defaultConsumerSecret,
      passkey: anySettings?.passkey || defaultPasskey,
      shortCode: anySettings?.shortcode || defaultShortCode
    };
  }

  const { data: settings } = await supabaseAdmin
    .from('payment_settings')
    .select('consumer_key, consumer_secret, passkey, shortcode')
    .eq('organization_id', organizationId)
    .maybeSingle();

  return {
    consumerKey: settings?.consumer_key || defaultConsumerKey,
    consumerSecret: settings?.consumer_secret || defaultConsumerSecret,
    passkey: settings?.passkey || defaultPasskey,
    shortCode: settings?.shortcode || defaultShortCode
  };
}

async function getAccessToken(consumerKey: string, consumerSecret: string): Promise<string> {
  const baseUrl = environment === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox-api.safaricom.co.ke';

  if (!consumerKey || !consumerSecret) {
    throw new Error('M-Pesa credentials not configured. Set MPESA_CONSUMER_KEY and MPESA_CONSUMER_SECRET in .env.local or configure in Payment Settings.');
  }

  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  const response = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get M-Pesa access token: ${errorText}`);
  }

  const data = await response.json();
  return data.access_token;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, amount, transactionDesc, transactionType } = body;

    if (!phone || !amount) {
      return NextResponse.json({ message: 'Phone and amount required' }, { status: 400 });
    }

    const authorization = request.headers.get('authorization') ?? request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const decoded = decodeJWT(authorization.split(' ')[1]);
    const userId = decoded?.sub;
    
    // Try to get organization_id from user metadata first, then from tenant record
    let organizationId = decoded?.user_metadata?.organization_id;
    const userRole = decoded?.user_metadata?.role;
    
    // If no org in metadata, try to look up tenant's organization
    if (!organizationId && userRole === 'tenant') {
      const tenantId = decoded?.user_metadata?.tenant_id ?? userId;
      if (tenantId) {
        organizationId = await getTenantOrganizationId(tenantId, decoded?.email);
      }
    }
    
    // If tenant lookup fails, try using user_id directly as fallback
    if (!organizationId && !userRole) {
      organizationId = await getTenantOrganizationId(userId, decoded?.email);
    }

    // Get credentials - prefer organization-specific if available
    const creds = await getOrganizationCredentials(organizationId);

    const accessToken = await getAccessToken(creds.consumerKey, creds.consumerSecret);

    const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
    const password = Buffer.from(`${creds.shortCode}${creds.passkey}${timestamp}`).toString('base64');

    const baseUrl = environment === 'production'
      ? 'https://api.safaricom.co.ke'
      : 'https://sandbox-api.safaricom.co.ke';

    const callbackUrl = process.env.NEXT_PUBLIC_APP_URL 
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/mpesa/callback` 
      : 'https://webhook.site';

    const response = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        BusinessShortCode: creds.shortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(amount),
        PartyA: phone,
        PartyB: creds.shortCode,
        PhoneNumber: phone,
        CallBackURL: callbackUrl,
        AccountReference: userId ? `${userId}|${transactionType || 'rent'}` : 'SPRINGFIELD',
        TransactionDesc: transactionDesc || 'Rent Payment'
      })
    });

    const result = await response.json();
    
    if (!response.ok) {
      console.error('M-Pesa STK push failed:', { 
        status: response.status, 
        result, 
        shortCode: creds.shortCode,
        environment 
      });
      return NextResponse.json({ 
        message: result.errorMessage ?? result.messageRequestDescription ?? 'Payment initiation failed',
        requestId: result.requestId,
        errorCode: result.errorCode
      }, { status: response.status });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('STK push error:', error.message);
    return NextResponse.json({ message: 'M-Pesa error: ' + (error.message ?? 'Unknown error'), error: error.message }, { status: 500 });
  }
}
