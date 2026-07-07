import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAllAdminUsers } from '../../../../lib/supabaseAdmin';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase server environment variables');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function getTenantId(userId: string): Promise<string | null> {
  const users = await getAllAdminUsers();
  const user = users.find((u: any) => u.id === userId);
  return user?.user_metadata?.tenant_id ?? null;
}

async function getTenantIdByEmail(email: string): Promise<string | null> {
  const { data: tenants, error } = await supabaseAdmin.from('tenants').select('id').eq('email', email).limit(1);
  if (error || !tenants || tenants.length === 0) return null;
  return tenants[0].id;
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId');
    const email = request.nextUrl.searchParams.get('email');

    let tenantId: string | null = null;
    if (userId) {
      tenantId = await getTenantId(userId);
    } else if (email) {
      tenantId = await getTenantIdByEmail(email);
    }

    if (!tenantId) {
      return NextResponse.json({ notifications: [], message: 'Tenant not found.' });
    }

    const { data, error } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('recipient', 'tenant')
      .order('created_at', { ascending: false });

    if (error) {
      const fallback = await supabaseAdmin.from('payments')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('transaction_type', 'notification');
      return NextResponse.json({ notifications: fallback.data?.map((p: any) => ({ ...p, message: p.description })) ?? [] });
    }

    return NextResponse.json({ notifications: data ?? [] });
  } catch (error: any) {
    return NextResponse.json({ notifications: [], message: error.message ?? 'Unable to load notifications.' }, { status: 500 });
  }
}