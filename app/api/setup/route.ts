import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase server environment variables');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action, email, password, fullName, targetEmail } = body;

  if (action === 'create-super-admin') {
    const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers();

    if (usersError) {
      return NextResponse.json({ message: usersError.message }, { status: 500 });
    }

    const existingUser = usersData?.users.find((user) => user.email === email);
    if (existingUser) {
      return NextResponse.json({ message: 'Super admin already exists.' }, { status: 200 });
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role: 'super_admin' },
    });

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Super admin created.', userId: data.user?.id }, { status: 201 });
  }

  if (action === 'assign-properties-to-landlord') {
    const { data: users, error: usersErr } = await supabaseAdmin.auth.admin.listUsers();
    if (usersErr) return NextResponse.json({ message: usersErr.message }, { status: 500 });

    const { data: targetProfile } = await supabaseAdmin
      .from('profiles')
      .select('organization_id')
      .eq('email', targetEmail)
      .single();

    if (!targetProfile?.organization_id) {
      const { data: newOrg } = await supabaseAdmin
        .from('organizations')
        .insert({ name: `${targetEmail?.split('@')[0] ?? 'Property Manager'} Organization` })
        .select('id')
        .single();

      if (newOrg) {
        await supabaseAdmin
          .from('profiles')
          .update({ organization_id: newOrg.id })
          .eq('email', targetEmail);

        await supabaseAdmin
          .from('properties')
          .update({ organization_id: newOrg.id })
          .eq('organization_id', null);

        return NextResponse.json({ message: `Properties assigned to ${targetEmail}.`, organizationId: newOrg.id });
      }
      return NextResponse.json({ message: 'Failed to create organization.' }, { status: 500 });
    }

    await supabaseAdmin
      .from('properties')
      .update({ organization_id: targetProfile.organization_id })
      .eq('organization_id', null);

    return NextResponse.json({ message: `Properties assigned to ${targetEmail}.`, organizationId: targetProfile.organization_id });
  }

  if (action === 'setup-all-landlords') {
    const { data: profiles, error: profilesErr } = await supabaseAdmin
      .from('profiles')
      .select('id, user_id, email, organization_id')
      .eq('role', 'project_manager');

    if (profilesErr) return NextResponse.json({ message: profilesErr.message }, { status: 500 });

    for (const profile of profiles ?? []) {
      if (!profile.organization_id) {
        const { data: newOrg } = await supabaseAdmin
          .from('organizations')
          .insert({ name: `${profile.email?.split('@')[0] ?? 'Property Manager'} Organization` })
          .select('id')
          .single();

        if (newOrg) {
          await supabaseAdmin
            .from('profiles')
            .update({ organization_id: newOrg.id })
            .eq('id', profile.id);
        }
      }
    }

    const firstLandlord = (profiles ?? [])[0];
    if (firstLandlord?.organization_id) {
      await supabaseAdmin
        .from('properties')
        .update({ organization_id: firstLandlord.organization_id })
        .eq('organization_id', null);
    }

    return NextResponse.json({ message: 'All landlords set up.', count: profiles?.length ?? 0, firstLandlordEmail: firstLandlord?.email });
  }

  return NextResponse.json({ message: 'Invalid action.' }, { status: 400 });
}

export async function GET() {
  const response = await supabaseAdmin.auth.admin.listUsers();
  return NextResponse.json({ users: response.data?.users ?? [] });
}