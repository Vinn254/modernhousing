import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  adminRequest,
  badRequest,
  createAdminUser,
  getAllAdminUsers,
  getUserByEmail,
  requestError,
} from '../../../lib/supabaseAdmin';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase server environment variables');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

interface LandlordProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  role: 'project_manager';
  organization_id?: string | null;
  status: 'active' | 'inactive' | 'pending';
  created_at: string;
}

function normalizeLandlord(user: any, profile?: LandlordProfile) {
  return {
    id: user?.id ?? profile?.user_id,
    email: profile?.email ?? user?.email ?? '',
    full_name: profile?.full_name ?? user?.user_metadata?.full_name ?? user?.email ?? 'Project Manager',
    organization: profile?.organization_id ?? '',
    phone: profile?.phone ?? null,
    status: profile?.status ?? (user?.email_confirmed_at ? 'active' : 'pending'),
    created_at: profile?.created_at ?? user?.created_at ?? '',
  };
}

async function getProfiles() {
  const { data, error } = await supabaseAdmin.from('profiles').select('*').eq('role', 'project_manager');
  if (error) throw error;
  return (data ?? []) as LandlordProfile[];
}

async function getProfile(userId: string) {
  const { data, error } = await supabaseAdmin.from('profiles').select('*').eq('user_id', userId).single();
  if (error && error.code !== 'PGRST116') throw error;
  return (data ?? null) as LandlordProfile | null;
}

async function upsertProfile(userId: string, fullName: string, email: string, organizationId: string | null, status: LandlordProfile['status'], phone?: string | null) {
    const existing = await getProfile(userId);
    const payload = {
      user_id: userId,
      full_name: fullName,
      email,
      role: 'project_manager' as const,
      organization_id: organizationId,
      status,
      phone,
    };

    if (existing) {
      const { data, error } = await supabaseAdmin.from('profiles').update(payload).eq('user_id', userId).select('*').single();
      if (error) throw error;
      return data as LandlordProfile;
    }

    const { data, error } = await supabaseAdmin.from('profiles').insert(payload).select('*').single();
    if (error) throw error;
    return data as LandlordProfile;
  }

async function updateLandlordMetadata(userId: string, input: { fullName?: string; status?: LandlordProfile['status']; password?: string }) {
  const users = await getAllAdminUsers();
  const user = users.find((item) => item.id === userId);
  if (!user) throw new Error('Landlord not found.');

  const body: Record<string, any> = {
    user_metadata: {
      ...(user.user_metadata ?? {}),
      full_name: input.fullName ?? user.user_metadata?.full_name ?? user.email,
      role: 'project_manager',
      status: input.status ?? user.user_metadata?.status ?? 'active',
    },
  };

  if (input.password) {
    body.password = input.password;
  }

  return adminRequest<any>(`/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function GET() {
  try {
    const [users, profiles] = await Promise.all([getAllAdminUsers(), getProfiles()]);
    const profileByUserId = new Map(profiles.map((profile) => [profile.user_id, profile]));
    const landlordIds = new Set<string>();

    users.forEach((user) => {
      if (user.user_metadata?.role === 'project_manager') landlordIds.add(user.id);
    });
    profiles.forEach((profile) => landlordIds.add(profile.user_id));

    const landlords = Array.from(landlordIds)
      .map((id) => normalizeLandlord(users.find((user) => user.id === id), profileByUserId.get(id)))
      .filter((landlord) => landlord.id);

    return NextResponse.json({ landlords });
  } catch (error) {
    return requestError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = String(body.email ?? '').trim();
    const password = String(body.password ?? '');
    const fullName = String(body.fullName ?? body.name ?? '').trim();
    const organization = String(body.organization ?? '').trim();
    const phone = body.phone ? String(body.phone).trim() : null;
    const status: LandlordProfile['status'] = body.status ?? 'pending';

    if (!email || !password || !fullName || !organization) {
      return badRequest('Email, password, full name, and organization are required.');
    }

    const existingUser = await getUserByEmail(email);
    let user = existingUser;

    if (user) {
      user = await updateLandlordMetadata(user.id, { fullName, status });
    } else {
      const created = await createAdminUser({ email, password, fullName, role: 'project_manager' });
      user = created.user;
      user = await updateLandlordMetadata(user.id, { fullName, status });
    }

    if (!user) throw new Error('Unable to create landlord.');

    const profile = await upsertProfile(user.id, fullName, email, null, status, phone);

    return NextResponse.json({ landlord: normalizeLandlord(user, profile) }, { status: existingUser ? 200 : 201 });
  } catch (error: any) {
    return NextResponse.json({ message: error.message ?? 'Unable to save landlord.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = String(body.userId ?? '').trim();
    const fullName = String(body.fullName ?? '').trim();
    const status = body.status as LandlordProfile['status'] | undefined;
    const password = body.password ? String(body.password) : '';
    const phone = body.phone ? String(body.phone).trim() : undefined;

    if (!userId || !fullName) {
      return badRequest('Landlord ID and full name are required.');
    }

    const user = await updateLandlordMetadata(userId, { fullName, status, password: password || undefined });
    const profile = await upsertProfile(userId, fullName, user.email, null, status ?? 'active', phone ?? undefined);

    return NextResponse.json({ landlord: normalizeLandlord(user, profile) });
  } catch (error: any) {
    return NextResponse.json({ message: error.message ?? 'Unable to update landlord.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('id');
    if (!userId) return badRequest('Landlord ID is required.');

    await supabaseAdmin.from('notifications').delete().eq('admin_id', userId);
    await supabaseAdmin.from('payments').delete().eq('tenant_id', null).eq('transaction_type', 'landlord_notification');
    await supabaseAdmin.from('subscriptions').delete().eq('admin_id', userId);
    await supabaseAdmin.from('profiles').delete().eq('user_id', userId);
    await adminRequest(`/auth/v1/admin/users/${encodeURIComponent(userId)}`, { method: 'DELETE' });

    return NextResponse.json({ message: 'Project manager permanently removed.' });
  } catch (error: any) {
    return NextResponse.json({ message: error.message ?? 'Unable to remove project manager.' }, { status: 500 });
  }
}
