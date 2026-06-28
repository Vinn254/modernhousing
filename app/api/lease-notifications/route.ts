import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase server environment variables');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

export async function GET(request: NextRequest) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekStr = nextWeek.toISOString().slice(0, 10);

    // Find leases ending today (overdue) or within next 7 days (about to expire)
    const { data: tenants, error } = await supabaseAdmin
      .from('tenants')
      .select('id, full_name, email, lease_end, units(property_id)')
      .or(`lease_end.eq.${today},lease_end.lte.${nextWeekStr}`)
      .eq('units.occupancy_status', 'occupied');

    if (error) throw error;

    const notificationsSent: any[] = [];

    for (const tenant of tenants ?? []) {
      const leaseEnd = tenant.lease_end;
      const isOverdue = leaseEnd <= today;
      const unit = tenant.units?.[0];
      const propertyId = unit?.property_id;

      // Get property name
      let propertyName = 'your property';
      if (propertyId) {
        const { data: prop } = await supabaseAdmin.from('properties').select('name').eq('id', propertyId).single();
        propertyName = prop?.name ?? 'your property';
      }

      let message = isOverdue
        ? `Your lease for ${propertyName} has ended. Please contact your landlord to discuss renewal or relocation options.`
        : `Your lease for ${propertyName} ends on ${leaseEnd}. Please prepare for renewal or relocation.`;

      const { data: notification } = await supabaseAdmin
        .from('notifications')
        .insert({
          tenant_id: tenant.id,
          property_id: propertyId,
          recipient: 'tenant',
          type: isOverdue ? 'lease_expired' : 'lease_ending',
          message,
          status: 'sent',
        })
        .select()
        .single();

      notificationsSent.push(notification);
    }

    return NextResponse.json({ message: `Sent ${notificationsSent.length} lease notifications.`, notifications: notificationsSent });
  } catch (error: any) {
    return NextResponse.json({ message: error.message ?? 'Unable to check leases.' }, { status: 500 });
  }
}