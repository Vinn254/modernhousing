import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { adminRequest, badRequest, createAdminUser, getAllAdminUsers, getUserByEmail, requestError, } from '../../../lib/supabaseAdmin';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
function getSupabaseAdmin() {
    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error('Missing Supabase server environment variables');
    }
    return createClient(supabaseUrl, serviceRoleKey);
}
function decodeJWT(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3)
            return null;
        let payload = parts[1];
        payload = payload.replace(/-/g, '+').replace(/_/g, '/');
        while (payload.length % 4)
            payload += '=';
        try {
            return JSON.parse(atob(payload));
        }
        catch {
            return JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
        }
    }
    catch {
        return null;
    }
}
async function getAuthContext(request) {
    const client = getSupabaseAdmin();
    const cookie = request.headers.get('cookie') ?? '';
    const authorization = request.headers.get('authorization') ?? request.headers.get('Authorization');
    let sessionUser = null;
    if (authorization?.startsWith('Bearer ')) {
        const token = authorization.split(' ')[1];
        const decoded = decodeJWT(token);
        if (decoded?.sub) {
            sessionUser = { id: decoded.sub, email: decoded.email, user_metadata: decoded.user_metadata || {} };
        }
    }
    if (!sessionUser && cookie) {
        try {
            const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { cookie } } });
            const { data: { user } } = await supabaseAuth.auth.getUser();
            sessionUser = user;
        }
        catch (e) { }
    }
    if (!sessionUser) {
        return { isSuperAdmin: false, profile: null, userId: undefined, organizationId: null };
    }
    const userMetadata = sessionUser.user_metadata || {};
    const { data: profile } = await client
        .from('profiles')
        .select('id, user_id, organization_id, role, full_name, email')
        .eq('user_id', sessionUser.id)
        .single();
    let orgId = profile?.organization_id ?? userMetadata.organization_id ?? null;
    // Fallback: query by email
    if (!orgId && sessionUser.email) {
        const { data: profileByEmail } = await client
            .from('profiles')
            .select('id, user_id, organization_id, role, full_name, email')
            .eq('email', sessionUser.email)
            .single();
        orgId = profileByEmail?.organization_id ?? null;
    }
    return {
        isSuperAdmin: profile?.role === 'super_admin' || userMetadata.role === 'super_admin',
        profile,
        userId: sessionUser.id,
        organizationId: orgId,
    };
}
async function upsertAgentProfile(userId, fullName, email, phone, organizationId) {
    const client = getSupabaseAdmin();
    const { data: existingProfile, error: profileFetchError } = await client
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
        role: 'agent',
        status: 'active',
        organization_id: organizationId ?? existingProfile?.organization_id ?? null,
    };
    if (existingProfile) {
        const { data, error } = await client
            .from('profiles')
            .update(payload)
            .eq('user_id', userId)
            .select('*')
            .single();
        if (error)
            throw error;
        return data;
    }
    const { data, error } = await client
        .from('profiles')
        .insert(payload)
        .select('*')
        .single();
    if (error)
        throw error;
    return data;
}
function normalizeAgent(user, profile) {
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
async function updateAgentMetadata(userId, input) {
    const users = await getAllAdminUsers();
    const user = users.find((item) => item.id === userId);
    if (!user)
        throw new Error('Agent not found.');
    const userMetadata = {
        ...(user.user_metadata ?? {}),
        full_name: input.fullName ?? user.user_metadata?.full_name ?? user.email,
        role: 'agent',
        property_id: input.propertyId ?? user.user_metadata?.property_id ?? '',
        property_name: input.propertyName ?? user.user_metadata?.property_name ?? '',
        landlord_id: input.landlordId ?? user.user_metadata?.landlord_id ?? '',
        agent_status: input.status ?? user.user_metadata?.agent_status ?? 'active',
    };
    return adminRequest(`/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
        method: 'PUT',
        body: JSON.stringify({ user_metadata: userMetadata }),
    });
}
export async function GET(request) {
    try {
        const client = getSupabaseAdmin();
        const authContext = await getAuthContext(request);
        const propertyId = request.nextUrl.searchParams.get('propertyId');
        const [users, profilesResult] = await Promise.all([
            getAllAdminUsers(),
            client.from('profiles').select('*').eq('role', 'agent'),
        ]);
        if (profilesResult.error)
            throw profilesResult.error;
        const profiles = (profilesResult.data ?? []);
        let agents = profiles.map((profile) => normalizeAgent(users.find((user) => user.id === profile.user_id), profile));
        if (!authContext.isSuperAdmin) {
            // Landlords: only see agents assigned to properties they CREATED
            if (authContext.userId) {
                const { data: userProps } = await client
                    .from('properties')
                    .select('id')
                    .eq('created_by', authContext.userId);
                const validPropertyIds = new Set((userProps ?? []).map((p) => p.id));
                agents = agents.filter((agent) => {
                    if (propertyId)
                        return agent.property_id === propertyId;
                    return agent.property_id && validPropertyIds.has(agent.property_id);
                });
            }
            else {
                return NextResponse.json({ agents: [] });
            }
        }
        else if (propertyId && authContext.isSuperAdmin) {
            agents = agents.filter((agent) => agent.property_id === propertyId);
        }
        return NextResponse.json({ agents });
    }
    catch (error) {
        return requestError(error);
    }
}
export async function POST(request) {
    try {
        const client = getSupabaseAdmin();
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
        if (!authContext.isSuperAdmin) {
            // Landlords: can only assign agents to properties they CREATED
            const { data: prop } = await client
                .from('properties')
                .select('id, created_by')
                .eq('id', propertyId)
                .eq('created_by', authContext.userId ?? '')
                .maybeSingle();
            if (!prop) {
                return NextResponse.json({ message: 'You can only assign agents to properties you created.' }, { status: 403 });
            }
        }
        const existingUser = await getUserByEmail(email);
        let user = existingUser;
        if (user) {
            user = await updateAgentMetadata(user.id, { fullName, propertyId, propertyName, status: 'active' });
        }
        else {
            const created = await createAdminUser({ email, password, fullName, role: 'agent', phone });
            user = created.user;
            user = await updateAgentMetadata(user.id, { fullName, propertyId, propertyName, status: 'active' });
        }
        if (!user) {
            throw new Error('Unable to create agent.');
        }
        const agentOrgId = authContext.organizationId;
        const profile = await upsertAgentProfile(user.id, fullName, email, phone, agentOrgId);
        return NextResponse.json({ agent: normalizeAgent(user, profile) }, { status: existingUser ? 200 : 201 });
    }
    catch (error) {
        return NextResponse.json({ message: error.message ?? 'Unable to save agent.' }, { status: 500 });
    }
}
export async function PATCH(request) {
    try {
        const client = getSupabaseAdmin();
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
        if (!authContext.isSuperAdmin && propertyId) {
            // Landlords: can only modify agents assigned to properties they CREATED
            const { data: prop } = await client
                .from('properties')
                .select('id, created_by')
                .eq('id', propertyId)
                .eq('created_by', authContext.userId ?? '')
                .maybeSingle();
            if (!prop) {
                return NextResponse.json({ message: 'You can only assign agents to properties you created.' }, { status: 403 });
            }
        }
        if (!propertyId || !propertyName) {
            return badRequest('Assign the agent to one property.');
        }
        const user = await updateAgentMetadata(userId, { fullName, propertyId, propertyName, status });
        const profilesResult = await client.from('profiles').select('*').eq('user_id', userId).single();
        if (profilesResult.error && profilesResult.error.code !== 'PGRST116') {
            throw profilesResult.error;
        }
        let profile = profilesResult.data;
        if (!profile && fullName) {
            const users = await getAllAdminUsers();
            const agent = users.find((item) => item.id === userId);
            profile = await upsertAgentProfile(userId, fullName, agent?.email ?? '');
        }
        return NextResponse.json({ agent: normalizeAgent(user, profile) });
    }
    catch (error) {
        return NextResponse.json({ message: error.message ?? 'Unable to update agent.' }, { status: 500 });
    }
}
export async function DELETE(request) {
    try {
        const client = getSupabaseAdmin();
        const userId = request.nextUrl.searchParams.get('id');
        if (!userId) {
            return badRequest('Agent ID is required.');
        }
        const authContext = await getAuthContext(request);
        if (!authContext.isSuperAdmin) {
            // Landlords: can only delete agents assigned to properties they CREATED
            const users = await getAllAdminUsers();
            const agent = users.find((item) => item.id === userId);
            const agentPropertyId = agent?.user_metadata?.property_id;
            if (agentPropertyId && authContext.userId) {
                const { data: prop } = await client
                    .from('properties')
                    .select('id')
                    .eq('id', agentPropertyId)
                    .eq('created_by', authContext.userId)
                    .maybeSingle();
                if (!prop) {
                    return NextResponse.json({ message: 'You can only manage agents assigned to properties you created.' }, { status: 403 });
                }
            }
            else {
                return NextResponse.json({ message: 'You can only manage agents assigned to properties you created.' }, { status: 403 });
            }
        }
        const user = await updateAgentMetadata(userId, { status: 'inactive' });
        if (!user)
            throw new Error('Agent not found.');
        await client.from('profiles').update({ status: 'inactive' }).eq('user_id', userId);
        return NextResponse.json({ agent: normalizeAgent(user) });
    }
    catch (error) {
        return NextResponse.json({ message: error.message ?? 'Unable to remove agent.' }, { status: 500 });
    }
}
