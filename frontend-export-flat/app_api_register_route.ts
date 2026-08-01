import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { adminRequest, badRequest } from '../../../lib/supabaseAdmin';
import { generateOTP } from '../../../lib/emailService';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase server environment variables');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

const planAmounts: Record<string, number> = {
  monthly: 2500,
  quarterly: 5000,
  yearly: 6000,
};

function todayPlus(plan: string) {
  const now = new Date();
  if (plan === 'quarterly') now.setMonth(now.getMonth() + 3);
  if (plan === 'yearly') now.setFullYear(now.getFullYear() + 1);
  else now.setMonth(now.getMonth() + 1);
  return now.toISOString().slice(0, 10);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = String(body.userId ?? '').trim();
    const organizationName = String(body.organizationName ?? '').trim();
    const managerName = String(body.managerName ?? '').trim();
    const email = String(body.email ?? '').trim();
    const plan = String(body.plan ?? 'monthly').trim();
    const role = String(body.role ?? 'project_manager').trim();

    if (!userId || !managerName || !email) {
      return badRequest('Missing registration fields.');
    }

    const profilePayload: any = {
      user_id: userId,
      full_name: managerName,
      email,
      role,
      status: 'inactive',
      approval_status: 'pending',
    };

    if (role === 'project_manager') {
      const organization = await supabaseAdmin
        .from('organizations')
        .insert({ name: organizationName || 'Unnamed Organization', details: 'Created by project manager signup flow' })
        .select()
        .single();

      if (organization.error) throw organization.error;

      profilePayload.organization_id = organization.data.id;
    }

    const profile = await supabaseAdmin
      .from('profiles')
      .insert(profilePayload)
      .select()
      .single();

    if (profile.error) throw profile.error;

    let subscriptionPayload: any = null;
    if (role === 'project_manager' && plan) {
      if (!planAmounts[plan]) {
        return badRequest('Invalid subscription plan.');
      }

      const subscriptionResponse = await fetch(`${request.nextUrl.origin}/api/subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminName: managerName,
          email,
          plan,
          adminId: userId,
          status: 'pending',
          start_date: new Date().toISOString().slice(0, 10),
          expiry_date: todayPlus(plan),
        }),
      });

      const text = await subscriptionResponse.text();
      try { subscriptionPayload = JSON.parse(text); } catch { subscriptionPayload = {}; }
    }

    const confirmRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        email_confirmed_at: new Date().toISOString(),
        user_metadata: {
          full_name: managerName,
          role,
          status: 'inactive',
          approval_status: 'pending',
        },
      }),
    });

    const confirmText = await confirmRes.text();
    console.log('[register] confirm email status:', confirmRes.status, confirmText);
    if (!confirmRes.ok) {
      console.error('[register] confirm email failed:', confirmText);
    }

    return NextResponse.json({ message: `${role === 'project_manager' ? 'Project manager' : 'Agent'} registered. Awaiting super admin approval.`, subscription: subscriptionPayload?.subscription ?? null }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ message: error.message ?? 'Unable to register account.' }, { status: 500 });
  }
}
