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
  const { action, email, password, fullName } = body;

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

  return NextResponse.json({ message: 'Invalid action.' }, { status: 400 });
}

export async function GET() {
  const response = await supabaseAdmin.auth.admin.listUsers();
  return NextResponse.json({ users: response.data?.users ?? [] });
}