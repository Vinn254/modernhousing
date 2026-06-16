import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { adminRequest, badRequest } from '../../../lib/supabaseAdmin';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase server environment variables');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = String(body.userId ?? '').trim();
    const organizationName = String(body.organizationName ?? '').trim();
    const managerName = String(body.managerName ?? '').trim();
    const email = String(body.email ?? '').trim();

    if (!userId || !organizationName || !managerName || !email) {
      return badRequest('Missing registration fields.');
    }

    const organization = await supabaseAdmin
      .from('organizations')
      .insert({ name: organizationName, details: 'Created by landlord signup flow' })
      .select()
      .single();

    if (organization.error) throw organization.error;

    const profile = await supabaseAdmin
      .from('profiles')
      .insert({
        user_id: userId,
        full_name: managerName,
        email,
        role: 'admin',
        organization_id: organization.data.id,
        status: 'active',
      })
      .select()
      .single();

    if (profile.error) throw profile.error;

    await adminRequest(`/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
      method: 'PUT',
      body: JSON.stringify({
        user_metadata: {
          full_name: managerName,
          role: 'admin',
          organization_id: organization.data.id,
        },
      }),
    });

    return NextResponse.json({ message: 'Landlord registered.' }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ message: error.message ?? 'Unable to register landlord.' }, { status: 500 });
  }
}
