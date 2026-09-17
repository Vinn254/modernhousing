import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import '../../../../lib/consoleGuard';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const descriptionForType: Record<string, string> = {
  tenancy_agreement: 'Tenancy Agreement Fee',
  water: 'Water Payment',
  garbage: 'Garbage Payment',
  service_charge: 'Service Charge Payment',
  parking: 'Parking Fee Payment',
  security: 'Security Fee Payment',
  internet: 'Internet Payment',
  laundry: 'Laundry Payment',
  pet_fees: 'Pet Fees Payment',
};

export async function POST(request: NextRequest) {
  try {
    const callbackData = await request.json();
    
    // M-Pesa sends callback with ResultCode in the body
    const { body } = callbackData;
    
    if (!body || body.ResultCode !== '0') {
      // Payment failed or cancelled
      return NextResponse.json({ message: 'Payment not successful' }, { status: 200 });
    }

    // Parse tenant info from AccountReference
    // New format: unitShortCode or tenantId|unitShortCode|paymentType
    const accountRef = body.AccountReference || '';
    const parts = accountRef.includes('|') ? accountRef.split('|') : [];
    const knownPaymentTypes = new Set(['rent', 'tenancy_agreement', 'water', 'garbage', 'service_charge', 'parking', 'security', 'internet', 'laundry', 'pet_fees', 'other', 'utility']);
    let tenantId: string | null = null;
    let unitShortCode: string | null = null;
    let paymentType = 'rent';

    if (parts.length === 0 && accountRef) {
      unitShortCode = accountRef;
    } else if (parts.length === 1) {
      unitShortCode = parts[0] || null;
    } else if (parts.length === 2) {
      if (knownPaymentTypes.has(parts[1] || '')) {
        tenantId = parts[0] || null;
        paymentType = parts[1] || 'rent';
      } else {
        tenantId = parts[0] || null;
        unitShortCode = parts[1] || null;
      }
    } else if (parts.length >= 3) {
      tenantId = parts[0] || null;
      unitShortCode = parts[1] || null;
      paymentType = parts[2] || 'rent';
    }

    if (!tenantId && unitShortCode) {
      const { data: unitRow } = await supabaseAdmin
        .from('units')
        .select('tenant_id')
        .eq('short_code', unitShortCode)
        .maybeSingle();

      tenantId = unitRow?.tenant_id ?? null;
    }

    const amount = body.CallbackMetadata?.Item?.find((i: any) => i.Name === 'Amount')?.Value ?? 0;
    const transactionDate = body.CallbackMetadata?.Item?.find((i: any) => i.Name === 'TransactionDate')?.Value ?? '';
    const transactionId = body.CallbackMetadata?.Item?.find((i: any) => i.Name === 'TransactionId')?.Value ?? '';

    if (!tenantId) {
      return NextResponse.json({ message: 'No tenant ID in callback' }, { status: 200 });
    }

    // Derive month_due from transaction date
    let monthDue = null;
    if (transactionDate) {
      const d = new Date(Number(transactionDate));
      monthDue = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
    }

    // Resolve tenant context for landlord notification and admin_email
    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('units(property_id, properties(created_by))')
      .eq('id', tenantId)
      .maybeSingle();

    const propertyId = tenant?.units?.property_id ?? null;
    let landlordEmail: string | null = null;

    if (propertyId) {
      const { data: prop } = await supabaseAdmin
        .from('properties')
        .select('created_by')
        .eq('id', propertyId)
        .maybeSingle();

      const createdBy = prop?.created_by;
      if (createdBy) {
        const { data: adminProfile } = await supabaseAdmin
          .from('profiles')
          .select('email')
          .eq('user_id', createdBy)
          .maybeSingle();
        landlordEmail = adminProfile?.email ?? null;
      }
    }

    const desc = descriptionForType[paymentType] ?? 'Rent Payment';

    // Create payment record
    const { data: payment, error } = await supabaseAdmin.from('payments').insert({
      tenant_id: tenantId,
      amount: Number(amount),
      transaction_type: paymentType,
      transaction_code: transactionId,
      description: desc,
      balance_remaining: 0,
      month_due: monthDue,
      paid_at: transactionDate ? new Date(Number(transactionDate)).toISOString() : new Date().toISOString(),
      transaction_number: `MPESA-${Date.now().toString().slice(-6)}`,
      admin_email: landlordEmail || null,
      property_id: propertyId || null,
    }).select();

    if (error) {
      return NextResponse.json({ message: 'Failed to record payment' }, { status: 500 });
    }

    // Send notifications to tenant and landlord
    const notificationInserts: any[] = [
      {
        recipient: 'tenant',
        tenant_id: tenantId,
        property_id: propertyId,
        admin_email: landlordEmail || null,
        type: 'rent_payment',
        message: `Your ${desc.toLowerCase()} payment of KSH ${amount} for ${monthDue || 'this month'} was received successfully.`,
        status: 'sent',
        created_at: new Date().toISOString(),
      },
    ];

    if (landlordEmail) {
      notificationInserts.push({
        recipient: 'project_manager',
        tenant_id: tenantId,
        property_id: propertyId,
        admin_email: landlordEmail,
        type: 'rent_payment',
        message: `Tenant payment of KSH ${amount} received for ${desc} (${monthDue || 'this month'}) via M-Pesa.`,
        status: 'sent',
        created_at: new Date().toISOString(),
      });
    }

    await supabaseAdmin.from('notifications').insert(notificationInserts);

    // Update tenant's outstanding balance if there are pending bills of matching type
    const { data: bills } = await supabaseAdmin.from('bills')
      .select('id, due_amount, paid_amount, balance')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (bills && bills.length > 0) {
      for (const bill of bills) {
        const newPaid = (bill.paid_amount || 0) + Number(amount);
        const newBalance = (bill.due_amount || 0) - newPaid;
        await supabaseAdmin.from('bills')
          .update({ paid_amount: newPaid, balance: Math.max(0, newBalance) })
          .eq('id', bill.id);
      }
    }

    return NextResponse.json({ message: 'Payment recorded successfully' });
  } catch (error: any) {
    return NextResponse.json({ message: error.message ?? 'Callback processing failed' }, { status: 500 });
  }
}