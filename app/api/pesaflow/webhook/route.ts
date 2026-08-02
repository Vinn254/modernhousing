import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logAuditEvent } from '../../../../lib/auditLogger';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

function verifyPesaFlowSignature(body: string, signature: string | null, secret: string | null): boolean {
  if (!signature || !secret) return false;
  const crypto = require('crypto');
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return signature === expected;
}

export async function POST(request: NextRequest) {
  try {
    const bodyText = await request.text();
    const signature = request.headers.get('x-pesaflow-signature');
    const webhookSecret = process.env.PESAFLOW_WEBHOOK_SECRET ?? null;

    if (!verifyPesaFlowSignature(bodyText, signature, webhookSecret)) {
      return NextResponse.json({ message: 'Invalid signature' }, { status: 401 });
    }

    const payload = JSON.parse(bodyText);

    /*
     * PesaFlow handles the actual money movement:
     * - 1% platform fee is deducted and sent to the super admin account
     * - 99% is sent to the landlord's bank account (fetched from their profile)
     * - This webhook only records the split in our database for transparency
     */
    const {
      transaction_id,
      tenant_id,
      landlord_id,
      original_amount,
      platform_fee_amount,
      landlord_amount,
      transaction_code,
      payment_method,
      status,
      metadata,
    } = payload;

    if (!transaction_id || !landlord_id || !original_amount) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    const { data: existingSplit } = await supabaseAdmin
      .from('split_payments')
      .select('id')
      .eq('pesaflow_transaction_id', transaction_id)
      .maybeSingle();

    if (existingSplit) {
      return NextResponse.json({ message: 'Split payment already processed', split_payment_id: existingSplit.id }, { status: 200 });
    }

    const { data: splitPayment, error: splitError } = await supabaseAdmin
      .from('split_payments')
      .insert({
        tenant_id: tenant_id || null,
        landlord_id,
        original_amount,
        platform_fee_amount: platform_fee_amount || (original_amount * 0.01),
        landlord_amount: landlord_amount || (original_amount * 0.99),
        transaction_code: transaction_code || null,
        pesaflow_transaction_id: transaction_id,
        payment_method: payment_method || 'mpesa',
        status: status === 'completed' ? 'completed' : 'pending',
        metadata: metadata || {},
      })
      .select('*')
      .single();

    if (splitError) {
      console.error('PesaFlow webhook split payment error:', splitError);
      return NextResponse.json({ message: splitError.message }, { status: 500 });
    }

    await logAuditEvent(
      landlord_id,
      null,
      'pesaflow_split_created',
      'split_payment',
      splitPayment.id,
      {
        transaction_id,
        original_amount,
        platform_fee_amount: splitPayment.platform_fee_amount,
        landlord_amount: splitPayment.landlord_amount,
        tenant_id,
        status: splitPayment.status,
      },
      request
    );

    return NextResponse.json({ message: 'Split payment processed', split_payment_id: splitPayment.id }, { status: 200 });
  } catch (error: any) {
    console.error('PesaFlow webhook error:', error);
    return NextResponse.json({ message: error?.message || 'Internal server error' }, { status: 500 });
  }
}
