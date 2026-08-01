import { NextResponse } from 'next/server';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
export async function adminRequest(path, options = {}) {
    const url = supabaseUrl || '';
    const key = serviceRoleKey || '';
    if (!url || !key) {
        throw new Error('Missing Supabase server environment variables');
    }
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${key}`);
    headers.set('apikey', key);
    headers.set('Content-Type', 'application/json');
    const response = await fetch(`${url}${path}`, {
        ...options,
        headers,
    });
    const text = await response.text();
    let body = null;
    if (text) {
        try {
            body = JSON.parse(text);
        }
        catch {
            body = { raw: text };
        }
    }
    if (!response.ok) {
        const message = body?.message || body?.error || `${response.status} ${response.statusText}`;
        throw new Error(message);
    }
    return body;
}
export async function listAdminUsers(page = 1, perPage = 100) {
    const data = await adminRequest(`/auth/v1/admin/users?page=${page}&per_page=${perPage}`);
    return data?.users ?? [];
}
export async function getAllAdminUsers() {
    const perPage = 100;
    let page = 1;
    const users = [];
    while (true) {
        const pageUsers = await listAdminUsers(page, perPage);
        users.push(...pageUsers);
        if (pageUsers.length < perPage)
            break;
        page += 1;
    }
    return users;
}
export async function getUserByEmail(email) {
    const users = await getAllAdminUsers();
    return users.find((user) => user.email?.toLowerCase() === email.toLowerCase()) ?? null;
}
export async function createAdminUser(input) {
    const user = await adminRequest('/auth/v1/admin/users', {
        method: 'POST',
        body: JSON.stringify({
            email: input.email,
            password: input.password,
            email_confirm: true,
            user_metadata: {
                full_name: input.fullName,
                role: input.role,
                phone: input.phone,
            },
        }),
    });
    return { user: user?.user ?? user, error: null };
}
export async function updateAdminUser(input) {
    const body = {};
    if (input.fullName) {
        body.user_metadata = {
            full_name: input.fullName,
            role: input.role,
        };
    }
    else if (input.role) {
        body.user_metadata = { role: input.role };
    }
    if (input.password) {
        body.password = input.password;
    }
    return adminRequest(`/auth/v1/admin/users/${encodeURIComponent(input.userId)}`, {
        method: 'PUT',
        body: JSON.stringify(body),
    });
}
export function jsonResponse(message, status) {
    return NextResponse.json({ message }, { status });
}
export function isMissingTableError(error, tableName) {
    const message = [error?.message, error?.details, error?.hint].filter(Boolean).join(' ');
    const normalizedMessage = message.toLowerCase();
    return normalizedMessage.includes(`public.${tableName}`) && normalizedMessage.includes('could not find');
}
export function requestError(error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ message }, { status: 500 });
}
export function badRequest(message) {
    return NextResponse.json({ message }, { status: 400 });
}
export async function requireJson(request) {
    try {
        return await request.json();
    }
    catch {
        throw new Error('Invalid JSON request body.');
    }
}
