import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { badRequest, createAdminUser, getAllAdminUsers, getUserByEmail, jsonResponse, requireJson, requestError, updateAdminUser, } from '../../../lib/supabaseAdmin';
function getSupabaseAdmin() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    return createClient(supabaseUrl, serviceRoleKey);
}
function normalizeAdmin(user, profile) {
    const role = profile?.role ?? user?.user_metadata?.role ?? 'admin';
    const fullName = profile?.full_name ?? user?.user_metadata?.full_name ?? user?.email ?? 'Administrator';
    return {
        id: user?.id ?? profile?.user_id,
        email: profile?.email ?? user?.email ?? '',
        full_name: fullName,
        role,
        status: profile?.status ?? (user?.email_confirmed_at ? 'active' : 'pending'),
        created_at: profile?.created_at ?? user?.created_at ?? '',
    };
}
async function upsertProfile(userId, fullName, email, role, status = 'active') {
    const supabaseAdmin = getSupabaseAdmin();
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
        role,
        status,
        organization_id: existingProfile?.organization_id ?? null,
    };
    if (existingProfile) {
        const { data, error } = await supabaseAdmin
            .from('profiles')
            .update(payload)
            .eq('user_id', userId)
            .select('*')
            .single();
        if (error)
            throw error;
        return data;
    }
    const { data, error } = await supabaseAdmin
        .from('profiles')
        .insert(payload)
        .select('*')
        .single();
    if (error)
        throw error;
    return data;
}
async function getAdminProfiles(role) {
    const supabaseAdmin = getSupabaseAdmin();
    let query = supabaseAdmin
        .from('profiles')
        .select('*')
        .in('role', ['admin', 'super_admin']);
    if (role === 'admin') {
        query = supabaseAdmin.from('profiles').select('*').eq('role', 'admin');
    }
    else if (role === 'super_admin') {
        query = supabaseAdmin.from('profiles').select('*').eq('role', 'super_admin');
    }
    const { data, error } = await query;
    if (error)
        throw error;
    return (data ?? []);
}
async function getProfile(userId) {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
    if (error && error.code !== 'PGRST116')
        throw error;
    return (data ?? null);
}
export async function GET(request) {
    try {
        const role = request.nextUrl.searchParams.get('role');
        const [users, profiles] = await Promise.all([getAllAdminUsers(), getAdminProfiles(role || undefined)]);
        const profileByUserId = new Map(profiles.map((profile) => [profile.user_id, profile]));
        const adminIds = new Set();
        users.forEach((user) => {
            if (user.user_metadata?.role === 'admin' || user.user_metadata?.role === 'super_admin') {
                adminIds.add(user.id);
            }
        });
        profiles.forEach((profile) => {
            if (profile.user_id)
                adminIds.add(profile.user_id);
        });
        const admins = Array.from(adminIds)
            .map((id) => normalizeAdmin(users.find((user) => user.id === id), profileByUserId.get(id)))
            .filter((admin) => admin.id);
        return NextResponse.json({ admins });
    }
    catch (error) {
        return requestError(error);
    }
}
export async function POST(request) {
    try {
        const body = await requireJson(request);
        const email = String(body.email ?? '').trim();
        const password = String(body.password ?? '');
        const fullName = String(body.fullName ?? body.name ?? '').trim();
        const role = body.role === 'super_admin' ? 'super_admin' : 'admin';
        if (!email || !fullName || !password) {
            return badRequest('Email, password, and full name are required.');
        }
        const existingUser = await getUserByEmail(email);
        if (existingUser?.user_metadata?.role === 'super_admin' && role === 'admin') {
            return NextResponse.json({ message: 'This user is already a super admin.' }, { status: 409 });
        }
        let user = existingUser;
        let profile;
        if (user) {
            const updated = await updateAdminUser({
                userId: user.id,
                fullName,
                role,
            });
            user = updated;
        }
        else {
            const created = await createAdminUser({ email, password, fullName, role });
            user = created.user;
        }
        if (!user) {
            return jsonResponse('Unable to create administrator.', 500);
        }
        profile = await upsertProfile(user.id, fullName, email, role);
        return NextResponse.json({ admin: normalizeAdmin(user, profile) }, { status: existingUser ? 200 : 201 });
    }
    catch (error) {
        return NextResponse.json({ message: error.message ?? 'Unable to save administrator.' }, { status: 500 });
    }
}
export async function PATCH(request) {
    try {
        const body = await requireJson(request);
        const userId = String(body.userId ?? '').trim();
        const fullName = String(body.fullName ?? '').trim();
        const status = body.status === 'inactive' ? 'inactive' : 'active';
        if (!userId) {
            return badRequest('Admin ID is required.');
        }
        const users = await getAllAdminUsers();
        const user = users.find((item) => item.id === userId);
        if (!user) {
            return NextResponse.json({ message: 'Administrator not found.' }, { status: 404 });
        }
        const role = user.user_metadata?.role === 'super_admin' ? 'super_admin' : 'admin';
        const updated = await updateAdminUser({
            userId,
            fullName: fullName || user.user_metadata?.full_name || user.email,
            role,
        });
        const profile = await upsertProfile(userId, fullName || user.user_metadata?.full_name || user.email || '', user.email, role, status);
        return NextResponse.json({ admin: normalizeAdmin(updated, profile) });
    }
    catch (error) {
        return NextResponse.json({ message: error.message ?? 'Unable to update administrator.' }, { status: 500 });
    }
}
export async function DELETE(request) {
    try {
        const userId = request.nextUrl.searchParams.get('id');
        if (!userId) {
            return badRequest('Admin ID is required.');
        }
        const [users, existingProfile] = await Promise.all([getAllAdminUsers(), getProfile(userId)]);
        const supabaseAdmin = getSupabaseAdmin();
        const user = users.find((item) => item.id === userId);
        if (!user) {
            return NextResponse.json({ message: 'Administrator not found.' }, { status: 404 });
        }
        const role = (user.user_metadata?.role === 'super_admin' ? 'super_admin' : 'admin');
        const profilePayload = {
            user_id: userId,
            full_name: user.user_metadata?.full_name || existingProfile?.full_name || user.email || 'Administrator',
            email: user.email,
            role,
            status: 'inactive',
            organization_id: existingProfile?.organization_id ?? null,
        };
        const { data, error } = existingProfile
            ? await supabaseAdmin
                .from('profiles')
                .update({ status: 'inactive' })
                .eq('user_id', userId)
                .select('*')
                .single()
            : await supabaseAdmin
                .from('profiles')
                .insert(profilePayload)
                .select('*')
                .single();
        if (error)
            throw error;
        return NextResponse.json({ admin: data });
    }
    catch (error) {
        return NextResponse.json({ message: error.message ?? 'Unable to remove administrator.' }, { status: 500 });
    }
}
