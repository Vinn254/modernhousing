import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAllAdminUsers } from '../../../../lib/supabaseAdmin';

async function getAuthContext(request: Request) {
  const authorization = request.headers.get('authorization') ?? request.headers.get('Authorization');
  let sessionUser: any = null;

  if (authorization?.startsWith('Bearer ')) {
    const token = authorization.split(' ')[1];
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      sessionUser = { id: payload.sub, email: payload.email, user_metadata: payload.user_metadata || {} };
    } catch {
      // ignore invalid token
    }
  }

  const userMetadata = sessionUser?.user_metadata || {};
  let orgId = userMetadata.organization_id ?? null;

  if (!orgId && sessionUser?.email) {
    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: profileByEmail } = await supabaseAdmin
      .from('profiles')
      .select('organization_id')
      .eq('email', sessionUser.email)
      .single();
    orgId = profileByEmail?.organization_id ?? null;
  }

  return {
    isSuperAdmin: userMetadata.role === 'super_admin',
    userId: sessionUser?.id ?? null,
    userEmail: sessionUser?.email ?? null,
    organizationId: orgId,
    userMetadata,
  };
}

export async function GET(request: Request) {
  try {
    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const url = new URL(request.url);
    const landlordId = url.searchParams.get('landlordId');

    const authContext = await getAuthContext(request);

    const canViewAll = authContext.isSuperAdmin;

    const [users, profilesResult, landlordProfilesResult] = await Promise.all([
      getAllAdminUsers(),
      supabaseAdmin.from('profiles').select('*').eq('role', 'agent'),
      supabaseAdmin.from('profiles').select('*').eq('role', 'project_manager'),
    ]);

    if (profilesResult.error) {
      return NextResponse.json({ message: `Profiles error: ${profilesResult.error.message}` }, { status: 500 });
    }
    if (landlordProfilesResult.error) {
      return NextResponse.json({ message: `Landlord profiles error: ${landlordProfilesResult.error.message}` }, { status: 500 });
    }

    const profiles = (profilesResult.data ?? []) as any[];
    const landlordProfiles = (landlordProfilesResult.data ?? []) as any[];
    const landlordById = new Map(landlordProfiles.map((profile: any) => [profile.user_id, profile]));
    const usersById = new Map(users.map((user: any) => [user.id, user]));

    let agents = profiles.map((profile: any) => {
      const user = usersById.get(profile.user_id);
      const landlord = landlordById.get(user?.user_metadata?.landlord_id || '');
      return {
        id: profile.user_id,
        name: user?.user_metadata?.full_name || profile.full_name,
        email: profile.email,
        phone: profile.phone,
        property_name: user?.user_metadata?.property_name || '',
        property_id: user?.user_metadata?.property_id || '',
        status: user?.user_metadata?.agent_status || profile.status || 'active',
        landlord: landlord?.full_name || 'Unknown landlord',
        landlord_email: landlord?.email || '',
        created_at: profile.created_at,
      };
    });

    if (landlordId) {
      agents = agents.filter((agent: any) => agent.landlord_email === landlordId || agent.property_id === landlordId);
    } else if (!canViewAll) {
      if (authContext.userMetadata?.role === 'project_manager') {
        const propertyId = authContext.userMetadata?.property_id;
        agents = agents.filter((agent: any) => agent.property_id === propertyId);
      } else if (authContext.organizationId) {
        const { data: orgProps } = await supabaseAdmin
          .from('properties')
          .select('id')
          .eq('organization_id', authContext.organizationId);
        const propIds = (orgProps ?? []).map((p: any) => p.id);

        if (propIds.length > 0) {
          const { data: orgUnits } = await supabaseAdmin.from('units').select('property_id').in('property_id', propIds);
          const allowedPropertyIds = Array.from(new Set((orgUnits ?? []).map((u: any) => u.property_id)));
          agents = agents.filter((agent: any) => allowedPropertyIds.includes(agent.property_id));
        } else {
          agents = [];
        }
      } else if (authContext.userId) {
        const { data: userProps } = await supabaseAdmin
          .from('properties')
          .select('id')
          .eq('created_by', authContext.userId);
        const propIds = (userProps ?? []).map((p: any) => p.id);

        if (propIds.length > 0) {
          const { data: orgUnits } = await supabaseAdmin.from('units').select('property_id').in('property_id', propIds);
          const allowedPropertyIds = Array.from(new Set((orgUnits ?? []).map((u: any) => u.property_id)));
          agents = agents.filter((agent: any) => allowedPropertyIds.includes(agent.property_id));
        } else {
          agents = [];
        }
      } else {
        agents = [];
      }
    }

    return NextResponse.json({ agents });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message || 'Internal server error', error: String(error) }, { status: 500 });
  }
}
