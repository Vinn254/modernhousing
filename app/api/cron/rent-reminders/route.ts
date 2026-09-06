import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const cronSecret = process.env.CRON_SECRET ?? '';

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase server environment variables');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
const dayMs = 24 * 60 * 60 * 1000;
const RENT_PERIOD_DAYS = 30;
const REMINDER_DAYS_BEFORE = 2;
const OVERDUE_WEEKS_WARNING = 2;
const OVERDUE_NOTIFY_INTERVAL_DAYS = 5;

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(date: Date): string {
  return `${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()}`;
}

/**
 * System-wide rent due/overdue check intended to run on a schedule (Vercel cron).
 * Unlike /api/rent/due-check (which is scoped to the signed-in landlord), this
 * sweeps every tenant and creates the tenant + landlord overdue notifications.
 *
 * Secured with a shared secret via Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (Vercel cron sends Authorization: Bearer <CRON_SECRET>).
    if (cronSecret) {
      const auth = request.headers.get('authorization') ?? request.headers.get('Authorization') ?? '';
      if (auth !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 });
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today;
    const reminderDate = new Date(todayStart.getTime() - REMINDER_DAYS_BEFORE * dayMs);
    const twoWeeksAgo = new Date(todayStart.getTime() - OVERDUE_WEEKS_WARNING * 7 * dayMs);

    // All tenants with their unit, rent, and property/landlord info.
    const { data: tenants, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('*, units(rent_amount, property_id, properties(name, address, created_by))');

    if (tenantError) throw tenantError;

    const landlordIds = new Set<string>();
    for (const t of (tenants ?? []) as any[]) {
      const lb = t?.units?.properties?.created_by;
      if (lb) landlordIds.add(lb);
    }

    const landlordEmails = new Map<string, string>();
    if (landlordIds.size > 0) {
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('user_id, email')
        .in('user_id', Array.from(landlordIds));
      for (const p of (profiles ?? []) as any[]) {
        landlordEmails.set(p.user_id, p.email);
      }
    }

    const rentByUnit = new Map<string, number>();
    const unitIds = (tenants ?? []).map((t: any) => t.unit_id).filter(Boolean);
    if (unitIds.length > 0) {
      const { data: allUnits } = await supabaseAdmin.from('units').select('id, rent_amount').in('id', unitIds);
      (allUnits ?? []).forEach((u: any) => rentByUnit.set(u.id, Number(u.rent_amount) || 0));
    }

    let notified = 0;
    const results: Array<{ tenant_id: string; full_name: string; days_overdue: number }> = [];

    for (const tenant of (tenants ?? []) as any[]) {
      const rentAmount = Number(tenant.units?.rent_amount) || Number(tenant.rent_amount) || rentByUnit.get(tenant.unit_id) || 0;
      if (rentAmount <= 0) continue;

      let nextDueDate: string;
      if (tenant.next_due_date) {
        nextDueDate = tenant.next_due_date;
      } else {
        const leaseStart = new Date(tenant.lease_start);
        if (isNaN(leaseStart.getTime())) continue;
        nextDueDate = new Date(leaseStart.getTime() + RENT_PERIOD_DAYS * dayMs).toISOString().slice(0, 10);
      }

      const dueDateObj = new Date(nextDueDate + 'T00:00:00');
      if (isNaN(dueDateObj.getTime())) continue;

      const monthKey = getMonthKey(dueDateObj);
      const dueDateStr = dueDateObj.toISOString().slice(0, 10);
      const monthDueLabel = monthLabel(dueDateObj);
      const propertyId = tenant.units?.property_id || null;
      const propertyName = tenant.units?.properties?.name || 'your property';
      const landlordEmail = landlordEmails.get(tenant.units?.properties?.created_by) || null;

      const { data: existingPayments } = await supabaseAdmin
        .from('payments')
        .select('*')
        .eq('tenant_id', tenant.id)
        .in('transaction_type', ['rent', 'overdue'])
        .not('month_due', 'is', null);

      const paid = (existingPayments ?? []).some((p: any) => {
        const mk = p.month_due?.substring(0, 7) || '';
        return mk === monthKey && Number(p.balance_remaining ?? 0) <= 0;
      });
      if (paid) continue;

      let overdueDates: Array<{ month_due: string; due_date: string; days_overdue: number }> =
        JSON.parse(tenant.overdue_dates || '[]');

      async function insertNotification(type: string, message: string, recipient: 'tenant' | 'project_manager') {
        try {
          // Cap overdue alerts at 2 per month per recipient (first + one reminder).
          if (type === 'overdue') {
            const monthStart = `${monthKey}-01T00:00:00.000Z`;
            const { data: monthOverdue } = await supabaseAdmin
              .from('notifications')
              .select('id')
              .eq('tenant_id', tenant.id)
              .eq('type', 'overdue')
              .eq('recipient', recipient)
              .gte('created_at', monthStart);
            if ((monthOverdue ?? []).length >= 2) return false;
          }

          const cutoff = new Date(todayStart.getTime() - OVERDUE_NOTIFY_INTERVAL_DAYS * dayMs).toISOString();
          const { data: existing } = await supabaseAdmin
            .from('notifications')
            .select('id')
            .eq('tenant_id', tenant.id)
            .eq('type', type)
            .eq('recipient', recipient)
            .gte('created_at', cutoff);
          if ((existing ?? []).length > 0) return false;

          const { error: insertError } = await supabaseAdmin.from('notifications').insert({
            recipient,
            tenant_id: tenant.id,
            property_id: propertyId,
            admin_email: recipient === 'project_manager' ? landlordEmail : null,
            type,
            message,
            status: 'sent',
            created_at: new Date().toISOString(),
          });
          if (insertError) {
            await supabaseAdmin.from('payments').insert({
              tenant_id: tenant.id,
              property_id: propertyId,
              description: message,
              transaction_type: recipient === 'tenant' ? 'notification' : 'landlord_notification',
              amount: 0,
              balance_remaining: 0,
              admin_email: landlordEmail,
              month_due: monthDueLabel,
              due_date: dueDateStr,
              paid_at: new Date().toISOString(),
            });
          }
          return true;
        } catch {
          return false;
        }
      }

      const daysPastDue = Math.floor((todayStart.getTime() - dueDateObj.getTime()) / dayMs);

      if (daysPastDue < 0) {
        if (todayStart >= reminderDate) {
          const reminderMsg = `Your lease for ${propertyName} requires rent of KSH ${rentAmount} for ${monthDueLabel}. Payment was due on ${dueDateStr}. Pay within 2 days to avoid overdue fees.`;
          await insertNotification('rent_reminder', reminderMsg, 'tenant');
          await insertNotification('rent_reminder', `[Notification to ${tenant.full_name || 'Tenant'} - ${propertyName}] ${reminderMsg}`, 'project_manager');
        }
      } else {
        // Record the overdue bill once per month.
        const hasOverdueRecord = (existingPayments ?? []).some((p: any) => {
          const mk = p.month_due?.substring(0, 7);
          return mk === monthKey && p.transaction_type === 'overdue';
        });
        if (!hasOverdueRecord) {
          await supabaseAdmin.from('payments').insert({
            tenant_id: tenant.id,
            description: `Rent overdue for ${monthDueLabel}`,
            transaction_type: 'overdue',
            amount: rentAmount,
            balance_remaining: rentAmount,
            due_amount: rentAmount,
            due_date: dueDateStr,
            month_due: monthDueLabel,
            transaction_number: `OV-${Date.now().toString().slice(-6)}`,
            paid_at: new Date().toISOString(),
          });
        }

        const tenantOverdueMsg = `Your lease for ${propertyName} (${tenant.lease_start} → ${tenant.lease_end}) - rent of KSH ${rentAmount} for ${monthDueLabel} was due on ${dueDateStr} and has not been received. ${daysPastDue > 0 ? daysPastDue + ' days overdue.' : 'Please pay immediately.'}`;
        const a = await insertNotification('overdue', tenantOverdueMsg, 'tenant');
        const b = await insertNotification('overdue', `[Notification to ${tenant.full_name || 'Tenant'} - ${propertyName} (${tenant.lease_start} → ${tenant.lease_end})] ${tenantOverdueMsg}`, 'project_manager');
        if (a || b) notified++;

        if (daysPastDue >= OVERDUE_WEEKS_WARNING * 7) {
          const tenantLongOverdueMsg = `Your lease for ${propertyName} (${tenant.lease_start} → ${tenant.lease_end}) - rent of KSH ${rentAmount} for ${monthDueLabel} was due on ${dueDateStr} and is now over ${OVERDUE_WEEKS_WARNING} weeks overdue (${daysPastDue}d total).`;
          await insertNotification('long_overdue', tenantLongOverdueMsg, 'tenant');
          await insertNotification('long_overdue', `[Notification to ${tenant.full_name || 'Tenant'} - ${propertyName}] ${tenantLongOverdueMsg}`, 'project_manager');
        }

        const existingEntry = overdueDates.find((d) => d.month_due === monthKey);
        if (existingEntry) {
          existingEntry.days_overdue = daysPastDue;
          existingEntry.due_date = dueDateStr;
        } else {
          overdueDates.push({ month_due: monthDueLabel, due_date: dueDateStr, days_overdue: daysPastDue });
        }
        overdueDates = overdueDates.filter((d) => new Date(d.due_date + 'T00:00:00') >= twoWeeksAgo);

        const newDueDate = new Date(dueDateObj.getTime() + RENT_PERIOD_DAYS * dayMs).toISOString().slice(0, 10);
        await supabaseAdmin
          .from('tenants')
          .update({ next_due_date: newDueDate, rent_amount: rentAmount, overdue_dates: JSON.stringify(overdueDates) })
          .eq('id', tenant.id);

        results.push({ tenant_id: tenant.id, full_name: tenant.full_name || '', days_overdue: daysPastDue });
      }
    }

    return NextResponse.json({
      status: 'ok',
      checked_at: new Date().toISOString(),
      today: todayStart.toISOString().slice(0, 10),
      notifications_sent: notified,
      overdue_tenants: results,
    });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message ?? 'Unable to process rent due checks.' }, { status: 500 });
  }
}
