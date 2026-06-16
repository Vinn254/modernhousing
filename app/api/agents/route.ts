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

interface AgentProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  role: 'agent';
  status: string;
  organization_id?: string | null;
  created_at: string;
}

async function upsertAgentProfile(userId: string, fullName: string, email: string) {
  const { data: existingProfile, error: profileFetchError } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (profileFetchError && profileFetchError.code !== 'PGRST116') {
    throw profileFetchError;
  }

  const payload = {
    user_id: userId,
    full_name: fullName,
    email,
    role: 'agent' as const,
    status: 'active',
    organization_id: existingProfile?.organization_id ?? null,
  };

  if (existingProfile) {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(payload)
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error) throw error;
    return data as AgentProfile;
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;
  return data as AgentProfile;
}

function normalizeAgent(user: any, profile?: AgentProfile) {
  return {
    id: user?.id ?? profile?.user_id,
    email: profile?.email ?? user?.email ?? '',
    full_name: profile?.full_name ?? user?.user_metadata?.full_name ?? user?.email ?? 'Agent',
    role: 'agent',
    status: profile?.status ?? (user?.email_confirmed_at ? 'active' : 'pending'),
    property_id: user?.user_metadata?.property_id ?? '',
    property_name: user?.user_metadata?.property_name ?? '',
    landlord_id: user?.user_metadata?.landlord_id ?? '',
    created_at: profile?.created_at ?? user?.created_at ?? '',
  };
}

async function updateAgentMetadata(userId: string, input: { fullName?: string; propertyId?: string; propertyName?: string; status?: string; landlordId?: string }) {
  const users = await getAllAdminUsers();
  const user = users.find((item) => item.id === userId);
  if (!user) throw new Error('Agent not found.');

  const userMetadata = {
    ...(user.user_metadata ?? {}),
    full_name: input.fullName ?? user.user_metadata?.full_name ?? user.email,
    role: 'agent',
    property_id: input.propertyId ?? user.user_metadata?.property_id ?? '',
    property_name: input.propertyName ?? user.user_metadata?.property_name ?? '',
    landlord_id: input.landlordId ?? user.user_metadata?.landlord_id ?? '',
    agent_status: input.status ?? user.user_metadata?.agent_status ?? 'active',
  };

  return adminRequest<any>(`/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: 'PUT',
    body: JSON.stringify({ user_metadata: userMetadata }),
  });
}

export async function GET() {
  try {
    const [users, profilesResult] = await Promise.all([
      getAllAdminUsers(),
      supabaseAdmin.from('profiles').select('*').eq('role', 'agent'),
    ]);

    if (profilesResult.error) throw profilesResult.error;

    const profiles = (profilesResult.data ?? []) as AgentProfile[];
    const profileByUserId = new Map(profiles.map((profile) => [profile.user_id, profile]));
    const agents = profiles.map((profile) => normalizeAgent(users.find((user) => user.id === profile.user_id), profile));

    return NextResponse.json({ agents });
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
    const propertyId = String(body.propertyId ?? body.property_id ?? '').trim();
    const propertyName = String(body.propertyName ?? body.property_name ?? '').trim();
    const landlordId = String(body.landlordId ?? body.landlord_id ?? '').trim();

    if (!email || !password || !fullName) {
      return badRequest('Email, password, and full name are required.');
    }

    if (!propertyId || !propertyName) {
      return badRequest('Assign the agent to one property.');
    }

    const existingUser = await getUserByEmail(email);
    let user = existingUser;

    if (user) {
      user = await updateAgentMetadata(user.id, { fullName, propertyId, propertyName, status: 'active', landlordId });
    } else {
      const created = await createAdminUser({ email, password, fullName, role: 'agent' });
      user = created.user;
      user = await updateAgentMetadata(user.id, { fullName, propertyId, propertyName, status: 'active', landlordId });
    }

    if (!user) {
      throw new Error('Unable to create agent.');
    }

    const profile = await upsertAgentProfile(user.id, fullName, email);

    return NextResponse.json({ agent: normalizeAgent(user, profile) }, { status: existingUser ? 200 : 201 });
  } catch (error: any) {
    return NextResponse.json({ message: error.message ?? 'Unable to save agent.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = String(body.userId ?? '').trim();
    const fullName = String(body.fullName ?? '').trim();
    const propertyId = String(body.propertyId ?? body.property_id ?? '').trim();
    const propertyName = String(body.propertyName ?? body.property_name ?? '').trim();
    const status = String(body.status ?? 'active').trim();

    if (!userId) {
      return badRequest('Agent ID is required.');
    }

    if (!propertyId || !propertyName) {
      return badRequest('Assign the agent to one property.');
    }

    const user = await updateAgentMetadata(userId, { fullName, propertyId, propertyName, status });
    const profilesResult = await supabaseAdmin.from('profiles').select('*').eq('user_id', userId).single();

    if (profilesResult.error && profilesResult.error.code !== 'PGRST116') {
      throw profilesResult.error;
    }

    let profile = profilesResult.data as AgentProfile | undefined;
    if (!profile && fullName) {
      const users = await getAllAdminUsers();
      const agent = users.find((item) => item.id === userId);
      profile = await upsertAgentProfile(userId, fullName, agent?.email ?? '');
    }

    return NextResponse.json({ agent: normalizeAgent(user, profile) });
  } catch (error: any) {
    return NextResponse.json({ message: error.message ?? 'Unable to update agent.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('id');

    if (!userId) {
      return badRequest('Agent ID is required.');
    }

  const user = await updateAgentMetadata(userId, { status: 'inactive' });
  if (!user) throw new Error('Agent not found.');
  await supabaseAdmin.from('profiles').update({ status: 'inactive' }).eq('user_id', userId);

    return NextResponse.json({ agent: normalizeAgent(user) });
  } catch (error: any) {
    return NextResponse.json({ message: error.message ?? 'Unable to remove agent.' }, { status: 500 });
  }
}
