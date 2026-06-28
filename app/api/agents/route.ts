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
  phone?: string | null;
  role: 'agent';
  status: string;
  organization_id?: string | null;
  created_at: string;
}

async function getAuthContext(request: NextRequest) {
  const cookie = request.headers.get('cookie') ?? '';
  const authorization = request.headers.get('authorization') ?? request.headers.get('Authorization');

  const headers: Record<string, string> = {};
  if (cookie) headers.cookie = cookie;
  if (authorization) headers.Authorization = authorization;

  const supabaseAuth = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '', {
    global: { headers },
  });

  let sessionUser: any = null;
  const { data: sessionData } = await supabaseAuth.auth.getSession();
  sessionUser = sessionData?.session?.user;

  if (!sessionUser && authorization?.startsWith('Bearer ')) {
    try {
      const token = authorization.split(' ')[1];
      const { data: { user } } = await supabaseAuth.auth.getUser(token);
      sessionUser = user;
    } catch (e) {}
  }

  if (!sessionUser) {
    return { isSuperAdmin: false, profile: null, userId: undefined };
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, user_id, organization_id, role, full_name, email')
    .eq('user_id', sessionUser.id)
    .single();

  if (!profile && sessionUser.email) {
    const { data: profileByEmail } = await supabaseAdmin
      .from('profiles')
      .select('id, user_id, organization_id, role, full_name, email')
      .eq('email', sessionUser.email)
      .single();
    return {
      isSuperAdmin: profileByEmail?.role === 'super_admin',
      profile: profileByEmail,
      userId: sessionUser.id,
    };
  }

  return {
    isSuperAdmin: profile?.role === 'super_admin',
    profile,
    userId: sessionUser.id,
  };
}

async function upsertAgentProfile(userId: string, fullName: string, email: string, phone?: string | null, organizationId?: string | null) {
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
    phone,
    role: 'agent' as const,
    status: 'active',
    organization_id: organizationId ?? existingProfile?.organization_id ?? null,
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

export async function GET(request: NextRequest) {
  try {
    const authContext = await getAuthContext(request);
    const propertyId = request.nextUrl.searchParams.get('propertyId');

    const [users, profilesResult] = await Promise.all([
      getAllAdminUsers(),
      supabaseAdmin.from('profiles').select('*').eq('role', 'agent'),
    ]);

    if (profilesResult.error) throw profilesResult.error;

    const profiles = (profilesResult.data ?? []) as AgentProfile[];

    let agents = profiles.map((profile) => normalizeAgent(users.find((user) => user.id === profile.user_id), profile));

    if (!authContext.isSuperAdmin) {
      if (!authContext.userId) {
        return NextResponse.json({ agents: [] });
      }

      const { data: orgProps } = await supabaseAdmin
        .from('properties')
        .select('id')
        .eq('user_id', authContext.userId);
      const validPropertyIds = new Set((orgProps ?? []).map((p: any) => p.id));

      agents = agents.filter((agent) => {
        if (propertyId) return agent.property_id === propertyId;
        return agent.property_id && validPropertyIds.has(agent.property_id);
      });
    } else if (propertyId) {
      agents = agents.filter((agent) => agent.property_id === propertyId);
    }

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
    const phone = body.phone ? String(body.phone).trim() : undefined;
    const propertyId = String(body.propertyId ?? body.property_id ?? '').trim();
    const propertyName = String(body.propertyName ?? body.property_name ?? '').trim();

    if (!email || !password || !fullName) {
      return badRequest('Email, password, and full name are required.');
    }

    if (!propertyId || !propertyName) {
      return badRequest('Assign the agent to one property.');
    }

    const authContext = await getAuthContext(request);
    if (!authContext.isSuperAdmin && authContext.userId && propertyId) {
      const { data: prop } = await supabaseAdmin
        .from('properties')
        .select('id, user_id')
        .eq('id', propertyId)
        .eq('user_id', authContext.userId)
        .maybeSingle();

      if (!prop) {
        return NextResponse.json({ message: 'You can only assign agents to properties in your own landlord workspace.' }, { status: 403 });
      }
    } else if (!authContext.isSuperAdmin && !authContext.userId && propertyId) {
      return NextResponse.json({ message: 'Unable to verify property access.' }, { status: 403 });
    }

    const existingUser = await getUserByEmail(email);
    let user = existingUser;

    if (user) {
      user = await updateAgentMetadata(user.id, { fullName, propertyId, propertyName, status: 'active' });
    } else {
      const created = await createAdminUser({ email, password, fullName, role: 'agent', phone });
      user = created.user;
      user = await updateAgentMetadata(user.id, { fullName, propertyId, propertyName, status: 'active' });
    }

    if (!user) {
      throw new Error('Unable to create agent.');
    }

    // Get organization_id from the property
    let agentOrgId: string | null = null;
    if (propertyId) {
      const { data: prop } = await supabaseAdmin.from('properties').select('organization_id').eq('id', propertyId).single();
      agentOrgId = prop?.organization_id ?? null;
    }

    const profile = await upsertAgentProfile(user.id, fullName, email, phone, agentOrgId);

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

    const authContext = await getAuthContext(request);
    const currentUserId = authContext.userId;
    if (!authContext.isSuperAdmin && currentUserId && propertyId) {
      const { data: prop } = await supabaseAdmin
        .from('properties')
        .select('id')
        .eq('id', propertyId)
        .eq('user_id', currentUserId)
        .maybeSingle();

      if (!prop) {
        return NextResponse.json({ message: 'You can only assign agents to properties in your own landlord workspace.' }, { status: 403 });
      }
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

    const authContext = await getAuthContext(request);
    if (!authContext.isSuperAdmin && authContext.userId) {
      const { data: agentProfile } = await supabaseAdmin
        .from('profiles')
        .select('user_id')
        .eq('user_id', userId)
        .single();

      if (agentProfile) {
        const users = await getAllAdminUsers();
        const agent = users.find((item) => item.id === userId);
        const agentPropertyId = agent?.user_metadata?.property_id;

        if (agentPropertyId) {
          const { data: prop } = await supabaseAdmin
            .from('properties')
            .select('id')
            .eq('id', agentPropertyId)
            .eq('user_id', authContext.userId)
            .maybeSingle();

          if (!prop) {
            return NextResponse.json({ message: 'You can only manage agents assigned to your own landlord workspace.' }, { status: 403 });
          }
        }
      }
    }

    const user = await updateAgentMetadata(userId, { status: 'inactive' });
    if (!user) throw new Error('Agent not found.');
    await supabaseAdmin.from('profiles').update({ status: 'inactive' }).eq('user_id', userId);

    return NextResponse.json({ agent: normalizeAgent(user) });
  } catch (error: any) {
    return NextResponse.json({ message: error.message ?? 'Unable to remove agent.' }, { status: 500 });
  }
}