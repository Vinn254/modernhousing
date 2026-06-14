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
  const { userId, organizationName, managerName, email } = body;

  if (!userId || !organizationName || !managerName || !email) {
    return NextResponse.json({ message: 'Missing registration fields.' }, { status: 400 });
  }

  const organization = await supabaseAdmin
    .from('organizations')
    .insert({ name: organizationName, details: 'Created by PM signup flow' })
    .select()
    .single();

  if (organization.error) {
    return NextResponse.json({ message: organization.error.message }, { status: 500 });
  }

  const profileInsert = await supabaseAdmin.from('profiles').insert({
    user_id: userId,
    full_name: managerName,
    email,
    role: 'project_manager',
    organization_id: organization.data.id,
    status: 'active',
  });

  if (profileInsert.error) {
    return NextResponse.json({ message: profileInsert.error.message }, { status: 500 });
  }

  return NextResponse.json({ message: 'Project manager registered.' }, { status: 201 });
}
