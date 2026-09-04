import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logAuditEvent } from '../../../../lib/auditLogger';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase server environment variables');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
const dayMs = 24 * 60 * 60 * 1000;
const RENT_PERIOD_DAYS = 30;
const REMINDER_DAYS_BEFORE = 2;
const OVERDUE_WEEKS_WARNING = 2;

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
      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { cookie } } });
      const { data: { user } } = await supabaseAuth.auth.getUser();
      sessionUser = user;
    } catch (e) {}
  }

  if (!sessionUser) {
    return { userId: undefined, userEmail: undefined, organizationId: null, isSuperAdmin: false, userMetadata: {} };
  }

  const userMetadata = sessionUser.user_metadata || {};
  let orgId = userMetadata.organization_id ?? null;

  if (!orgId && sessionUser.email) {
    const { data: profileByEmail } = await supabaseAdmin
      .from('profiles')
      .select('organization_id')
      .eq('email', sessionUser.email)
      .single();
    orgId = profileByEmail?.organization_id ?? null;
  }

  return {
    userId: sessionUser.id,
    userEmail: sessionUser.email,
    organizationId: orgId,
    isSuperAdmin: userMetadata.role === 'super_admin',
    userMetadata,
  };
}

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(date: Date): string {
  return `${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()}`;
}

async function hasTenantPaidForMonth(tenantId: string, monthKey: string): Promise<boolean> {
  const [{ data: payData }, { data: billData }] = await Promise.all([
    supabaseAdmin
      .from('payments')
      .select('balance_remaining')
      .eq('tenant_id', tenantId)
      .in('transaction_type', ['rent', 'overdue'])
      .not('month_due', 'is', null),

    supabaseAdmin
      .from('bills')
      .select('balance, paid_amount, due_amount')
      .eq('tenant_id', tenantId)
      .in('transaction_type', ['rent', 'overdue'])
      .not('month_due', 'is', null),
  ]);

  const checkPayment = (item: any) => {
    if (!item) return false;
    const mk = item.month_due?.substring(0, 7) || '';
    return mk === monthKey && (Number(item.balance_remaining ?? item.balance) <= 0);
  };

  return [...(payData ?? []), ...(billData ?? [])].some(item => {
    const mk = item.month_due?.substring(0, 7) || '';
    if (mk !== monthKey) return false;
    const balance = Number(item.balance_remaining ?? item.balance ?? 0);
    return balance <= 0;
  });
}

function getTenantMonthKeyFromDueDate(dueDate: string): string {
  const d = new Date(dueDate);
  return getMonthKey(d);
}

export async function GET(request: NextRequest) {
  try {
    const authContext = await getAuthContext(request);
    if (!authContext.userId) {
      return NextResponse.json({ message: 'Authentication required.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const targetTenantId = searchParams.get('tenantId');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today;
    const reminderDate = new Date(todayStart.getTime() - REMINDER_DAYS_BEFORE * dayMs);
    const twoWeeksAgo = new Date(todayStart.getTime() - OVERDUE_WEEKS_WARNING * 7 * dayMs);

    let unitIds: string[] = [];

    if (authContext.isSuperAdmin) {
      const { data: units } = await supabaseAdmin.from('units').select('id');
      unitIds = (units ?? []).map((u: any) => u.id);
    } else {
      const { data: userProps } = await supabaseAdmin
        .from('properties')
        .select('id')
        .eq('created_by', authContext.userId);
      const propIds = (userProps ?? []).map((p: any) => p.id);

      if (propIds.length > 0) {
        const { data: units } = await supabaseAdmin
          .from('units')
          .select('id')
          .in('property_id', propIds);
        unitIds = (units ?? []).map((u: any) => u.id);
      }

      if (unitIds.length === 0 && authContext.organizationId) {
        const { data: orgProps } = await supabaseAdmin
          .from('properties')
          .select('id')
          .eq('organization_id', authContext.organizationId);
        const orgPropIds = (orgProps ?? []).map((p: any) => p.id);
        if (orgPropIds.length > 0) {
          const { data: units } = await supabaseAdmin
            .from('units')
            .select('id')
            .in('property_id', orgPropIds);
          unitIds = (units ?? []).map((u: any) => u.id);
        }
      }
    }

    if (unitIds.length === 0) {
      return NextResponse.json({ status: 'ok', checked_at: new Date().toISOString(), overdue_tenants: [], notifications_sent: [] });
    }

    const { data: tenants, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('*, units(rent_amount, property_id, properties(name, address, created_by))')
      .in('unit_id', unitIds);

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

    if (tenantError) throw tenantError;

    const rentByUnit = new Map<string, number>();
    const { data: allUnits } = await supabaseAdmin.from('units').select('id, rent_amount').in('id', unitIds);
    (allUnits ?? []).forEach((u: any) => rentByUnit.set(u.id, Number(u.rent_amount) || 0));

    const results: Array<{
      tenant_id: string;
      full_name: string;
      email: string;
      rent_amount: number;
      next_due_date: string | null;
      overdue_dates: Array<{ month_due: string; due_date: string; days_overdue: number }>;
    }> = [];

    for (const tenant of (tenants ?? []) as any[]) {
      if (targetTenantId && tenant.id !== targetTenantId) continue;

      const rentAmount = Number(tenant.units?.rent_amount) || Number(tenant.rent_amount) || rentByUnit.get(tenant.unit_id) || 0;
      if (rentAmount <= 0) continue;

      let nextDueDate: string;
      if (tenant.next_due_date) {
        nextDueDate = tenant.next_due_date;
      } else {
        const leaseStart = new Date(tenant.lease_start);
        nextDueDate = new Date(leaseStart.getTime() + RENT_PERIOD_DAYS * dayMs).toISOString().slice(0, 10);
      }

      const dueDateObj = new Date(nextDueDate + 'T00:00:00');
      const monthKey = getMonthKey(dueDateObj);
      const isPaid = await hasTenantPaidForMonth(tenant.id, monthKey);

      if (isPaid) {
        const newDueDate = new Date(dueDateObj.getTime() + RENT_PERIOD_DAYS * dayMs).toISOString().slice(0, 10);
        if (tenant.next_due_date !== newDueDate) {
          await supabaseAdmin
            .from('tenants')
            .update({ next_due_date: newDueDate })
            .eq('id', tenant.id);
        }
        continue;
      }

      const { data: existingPayments, error: payError } = await supabaseAdmin
        .from('payments')
        .select('*')
        .eq('tenant_id', tenant.id)
        .in('transaction_type', ['rent', 'overdue'])
        .not('month_due', 'is', null);

      if (payError && !['42P01', '42501', 'PGRST116'].includes(payError.code || '')) {
        console.error('Payment lookup error:', payError);
      }

      const existingBills = (existingPayments ?? []).filter((p: any) => !['complaint', 'notification'].includes(p.transaction_type));

      let overdueDates: Array<{ month_due: string; due_date: string; days_overdue: number }> =
        JSON.parse(tenant.overdue_dates || '[]');

      const reminderDateStr = reminderDate.toISOString().slice(0, 10);
      const dueDateStr = dueDateObj.toISOString().slice(0, 10);
      const monthDueLabel = monthLabel(dueDateObj);

      const propertyId = tenant.units?.property_id || null;
      const propertyName = tenant.units?.properties?.name || 'your property';
      const landlordEmail = landlordEmails.get(tenant.units?.properties?.created_by) || authContext.userEmail || null;

      async function ensureNotification(type: string, message: string, recipient: 'tenant' | 'project_manager', notificationAdminEmail?: string) {
        const existingNotifs = await supabaseAdmin
          .from('notifications')
          .select('id')
          .eq('tenant_id', tenant.id)
          .eq('type', type)
          .gte('created_at', dueDateStr + 'T00:00:00')
          .lte('created_at', new Date(dueDateObj.getTime() + dayMs).toISOString().slice(0, 10) + 'T23:59:59');

        if ((existingNotifs.data ?? []).length > 0) return false;

         await supabaseAdmin.from('notifications').insert({
           recipient,
           tenant_id: tenant.id,
           property_id: propertyId,
           admin_email: recipient === 'project_manager' ? (notificationAdminEmail || landlordEmail) : null,
           type,
           message,
           status: 'sent',
           created_at: new Date().toISOString(),
         });

        return true;
      }

      const daysPastDue = Math.floor((todayStart.getTime() - dueDateObj.getTime()) / dayMs);

      if (daysPastDue < 0) {
        if (todayStart >= reminderDate) {
          await ensureNotification(
            'rent_reminder',
            `Your lease for ${propertyName} requires rent of KSH ${rentAmount} for ${monthDueLabel}. Payment was due on ${dueDateStr}. Pay within 2 days to avoid overdue fees.`,
            'tenant'
          );
          await ensureNotification(
            'rent_reminder',
            `${tenant.full_name || 'Tenant'} (unit ${tenant.units?.unit_number ?? ''}, ${propertyName}) rent of KSH ${rentAmount} is due on ${dueDateStr}.`,
            'project_manager',
            landlordEmail
          );
        }
      } else {
        const hasOverdueRecord = existingBills.some((p: any) => {
          const mk = p.month_due?.substring(0, 7);
          return mk === monthKey && p.transaction_type === 'overdue';
        });

        if (!hasOverdueRecord) {
          const insertResult = await supabaseAdmin.from('payments').insert({
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

          if (insertResult.error) throw insertResult.error;
          await logAuditEvent(
            authContext.userId,
            authContext.userEmail,
            'auto_create',
            'payment',
            tenant.id,
            { amount: rentAmount, due_date: dueDateStr, reason: 'rent_overdue' }
          );
        }

        await ensureNotification(
          'overdue',
          `Your lease for ${propertyName} - rent of KSH ${rentAmount} for ${monthDueLabel} was due on ${dueDateStr} and has not been received. Please pay immediately.`,
          'tenant'
        );

        await ensureNotification(
          'overdue',
          `${tenant.full_name || 'Tenant'} (unit ${tenant.units?.unit_number ?? ''}, ${propertyName}) rent of KSH ${rentAmount} is ${daysPastDue} days overdue. Due was ${dueDateStr}.`,
          'project_manager',
          landlordEmail
        );

        if (daysPastDue >= OVERDUE_WEEKS_WARNING * 7) {
          await ensureNotification(
            'long_overdue',
            `Your lease for ${propertyName} - rent of KSH ${rentAmount} for ${monthDueLabel} was due on ${dueDateStr} and is now over ${OVERDUE_WEEKS_WARNING} weeks overdue.`,
            'tenant'
          );
          await ensureNotification(
            'long_overdue',
            `${tenant.full_name || 'Tenant'} (${propertyName}) rent is ${daysPastDue} days overdue (${OVERDUE_WEEKS_WARNING}+ weeks). Contact tenant immediately.`,
            'project_manager',
            landlordEmail
          );
        }

        const existingEntry = overdueDates.find(d => d.month_due === monthKey);
        if (existingEntry) {
          existingEntry.days_overdue = daysPastDue;
          existingEntry.due_date = dueDateStr;
        } else {
          overdueDates.push({ month_due: monthDueLabel, due_date: dueDateStr, days_overdue: daysPastDue });
        }

        overdueDates = overdueDates.filter(d => {
          const entryDate = new Date(d.due_date + 'T00:00:00');
          return entryDate >= twoWeeksAgo;
        });

        const newDueDate = new Date(dueDateObj.getTime() + RENT_PERIOD_DAYS * dayMs).toISOString().slice(0, 10);

        await supabaseAdmin
          .from('tenants')
          .update({
            next_due_date: newDueDate,
            rent_amount: rentAmount,
            overdue_dates: JSON.stringify(overdueDates),
          })
          .eq('id', tenant.id);

        results.push({
          tenant_id: tenant.id,
          full_name: tenant.full_name || '',
          email: tenant.email || '',
          rent_amount: rentAmount,
          next_due_date: newDueDate,
          overdue_dates: overdueDates,
        });
      }
    }

    return NextResponse.json({
      status: 'ok',
      checked_at: new Date().toISOString(),
      today: todayStart.toISOString().slice(0, 10),
      overdue_tenants: results,
    });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message ?? 'Unable to process rent due checks.' }, { status: 500 });
  }
}
