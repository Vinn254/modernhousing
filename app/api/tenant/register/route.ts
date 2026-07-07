import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { adminRequest, badRequest, createAdminUser, getAllAdminUsers, getUserByEmail, requestError, updateAdminUser } from '../../../../lib/supabaseAdmin';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase server environment variables');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = String(body.email ?? '').trim();
    const password = String(body.password ?? '');

    if (!email || !password) {
      return badRequest('Email and password are required.');
    }

    const { data: tenants, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('id, full_name, email')
      .eq('email', email)
      .limit(1);

    if (tenantError) throw tenantError;
    if (!tenants || tenants.length === 0) {
      return NextResponse.json({ message: 'Tenant email was not added by an agent or landlord yet.' }, { status: 404 });
    }

    const existingUser = await getUserByEmail(email);

    if (existingUser) {
      await updateAdminUser({ userId: existingUser.id, fullName: tenants[0].full_name, role: 'tenant', password });
      await adminRequest(`/auth/v1/admin/users/${encodeURIComponent(existingUser.id)}`, {
        method: 'PUT',
        body: JSON.stringify({
          user_metadata: {
            ...(existingUser.user_metadata ?? {}),
            role: 'tenant',
            tenant_id: tenants[0].id,
          },
        }),
      });
      return NextResponse.json({ message: 'Tenant account updated. You can now sign in.' });
    }

    const created = await createAdminUser({ email, password, fullName: tenants[0].full_name, role: 'tenant' });

    if (!created.user) {
      return NextResponse.json({ message: 'Unable to create tenant account.' }, { status: 500 });
    }

    await adminRequest(`/auth/v1/admin/users/${encodeURIComponent(created.user.id)}`, {
      method: 'PUT',
      body: JSON.stringify({
        user_metadata: {
          ...(created.user.user_metadata ?? {}),
          role: 'tenant',
          tenant_id: tenants[0].id,
        },
      }),
    });

    return NextResponse.json({ message: 'Tenant account created. You can now sign in.' }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ message: error.message ?? 'Unable to register tenant.' }, { status: 500 });
  }
}
