import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export async function POST(request: NextRequest) {
  try {
    const callbackData = await request.json();
    
    // M-Pesa sends callback with ResultCode in the body
    const { body } = callbackData;
    
    if (!body || body.ResultCode !== '0') {
      // Payment failed or cancelled
      return NextResponse.json({ message: 'Payment not successful' }, { status: 200 });
    }

    // Parse tenant info from AccountReference (format: "tenantId|paymentType")
    const accountRef = body.AccountReference || '';
    const [tenantId, paymentType] = accountRef.includes('|') 
      ? accountRef.split('|') 
      : [null, 'rent'];

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

    // Create payment record
    const { data: payment, error } = await supabaseAdmin.from('payments').insert({
      tenant_id: tenantId,
      amount: Number(amount),
      transaction_type: paymentType,
      transaction_code: transactionId,
      description: paymentType === 'tenancy_agreement' ? 'Tenancy Agreement Fee' : 
                   paymentType === 'water' ? 'Water Payment' : 
                   paymentType === 'garbage' ? 'Garbage Payment' : 
                   paymentType === 'service_charge' ? 'Service Charge Payment' :
                   paymentType === 'parking' ? 'Parking Fee Payment' :
                   paymentType === 'security' ? 'Security Fee Payment' :
                   paymentType === 'internet' ? 'Internet Payment' :
                   paymentType === 'laundry' ? 'Laundry Payment' :
                   paymentType === 'pet_fees' ? 'Pet Fees Payment' : 'Utility Payment',
      balance_remaining: 0,
      month_due: monthDue,
      paid_at: transactionDate ? new Date(Number(transactionDate)).toISOString() : new Date().toISOString(),
      transaction_number: `MPESA-${Date.now().toString().slice(-6)}`,
    }).select();

    if (error) {
      console.error('Failed to record payment:', error);
      return NextResponse.json({ message: 'Failed to record payment' }, { status: 500 });
    }

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
    console.error('M-Pesa callback error:', error);
    return NextResponse.json({ message: error.message ?? 'Callback processing failed' }, { status: 500 });
  }
}