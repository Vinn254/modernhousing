import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing Supabase server environment variables');

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

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

async function getAuthContext(request: NextRequest) {
  const cookie = request.headers.get('cookie') ?? '';
  const authorization = request.headers.get('authorization') ?? request.headers.get('Authorization');

  let sessionUser: any = null;

  if (authorization?.startsWith('Bearer ')) {
    const token = authorization.split(' ')[1];
    const decoded = decodeJWT(token);
    if (decoded?.sub) {
      sessionUser = { id: decoded.sub, email: decoded.email, user_metadata: decoded.user_metadata || {} };
    }
  }

  if (!sessionUser && cookie) {
    try {
      const supabaseAuth = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '', { global: { headers: { cookie } } });
      const { data: { user } } = await supabaseAuth.auth.getUser();
      sessionUser = user;
    } catch (e) {}
  }

  if (!sessionUser) return { isSuperAdmin: false, sessionUser: null, userMetadata: {}, organizationId: null };

  const userMetadata = sessionUser.user_metadata || {};
  return {
    isSuperAdmin: userMetadata.role === 'super_admin',
    sessionUser,
    userMetadata,
    organizationId: userMetadata.organization_id ?? null,
  };
}

function generatePDFContent(invoice: any, tenant: any, balance: number) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Invoice ${invoice.month_due || invoice.id.slice(0, 8)}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    .header { text-align: center; margin-bottom: 30px; }
    .invoice-box { border: 1px solid #ddd; padding: 20px; border-radius: 8px; }
    .row { display: flex; justify-content: space-between; margin: 10px 0; }
    .label { font-weight: bold; }
    .amount { font-size: 18px; color: ${balance > 0 ? '#dc2626' : '#10b981'}; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Invoice</h1>
    <p>${new Date().toLocaleDateString()}</p>
  </div>
  <div class="invoice-box">
    <div class="row"><span class="label">Tenant:</span> <span>${tenant.full_name}</span></div>
    <div class="row"><span class="label">Property:</span> <span>${tenant.units?.properties?.name || '-'}</span></div>
    <div class="row"><span class="label">Month:</span> <span>${invoice.month_due || '-'}</span></div>
    <div class="row"><span class="label">Description:</span> <span>${invoice.description || '-'}</span></div>
    <div class="row"><span class="label">Amount Due:</span> <span>KES ${Number(invoice.amount || 0).toLocaleString()}</span></div>
    <div class="row"><span class="label">Due Date:</span> <span>${invoice.due_date || '-'}</span></div>
    <hr>
    <div class="row"><span class="label">Current Balance:</span> <span class="amount">${balance > 0 ? 'Owes KES ' : 'Credit KES '}${Math.abs(balance).toLocaleString()}</span></div>
  </div>
</body>
</html>`;
}

export async function GET(request: NextRequest) {
  try {
    const invoiceId = request.nextUrl.searchParams.get('invoiceId');
    if (!invoiceId) return NextResponse.json({ message: 'Invoice ID is required.' }, { status: 400 });

    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .select('*, tenants(full_name, email, phone, units(property_id, unit_number, properties(name)))')
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ message: 'Invoice not found.' }, { status: 404 });
    }

    const tenant = invoice.tenants;
    if (!tenant) {
      return NextResponse.json({ message: 'Tenant not found.' }, { status: 404 });
    }

    // Calculate balance from bills
    const { data: bills } = await supabaseAdmin
      .from('bills')
      .select('due_amount, paid_amount, penalty_fee')
      .eq('tenant_id', invoice.tenant_id)
      .order('month_due');

    let balance = 0;
    if (bills && bills.length > 0) {
      balance = bills.reduce((sum: number, b: any) => sum + (b.due_amount || 0) - (b.paid_amount || 0) - (b.penalty_fee || 0), 0);
    }

    // Generate PDF and upload to storage
    const htmlContent = generatePDFContent(invoice, tenant, balance);
    const fileName = `invoice-${invoiceId}.html`;
    const filePath = `invoices/${fileName}`;

    const { data: storageData, error: storageError } = await supabaseAdmin.storage
      .from('documents')
      .upload(filePath, Buffer.from(htmlContent), { contentType: 'text/html' });

    if (storageError && storageError.message.includes('already exists') === false) {
      throw storageError;
    }

    const { data: publicUrl } = supabaseAdmin.storage.from('documents').getPublicUrl(storageData?.path || filePath);

    // Update invoice with file_path
    await supabaseAdmin.from('invoices').update({ file_path: publicUrl.publicUrl }).eq('id', invoiceId);

    return NextResponse.json({ downloadUrl: publicUrl.publicUrl });
  } catch (error: any) {
    return NextResponse.json({ message: error.message ?? 'Unable to generate invoice.' }, { status: 500 });
  }
}