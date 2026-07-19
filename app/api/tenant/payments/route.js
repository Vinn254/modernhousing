import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAllAdminUsers } from '../../../../lib/supabaseAdmin';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase server environment variables');
}
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
async function getTenantId(userId) {
    const users = await getAllAdminUsers();
    const user = users.find((u) => u.id === userId);
    return user?.user_metadata?.tenant_id ?? null;
}
async function getTenantIdByEmail(email) {
    const { data: tenants, error } = await supabaseAdmin.from('tenants').select('id').eq('email', email).limit(1);
    if (error || !tenants || tenants.length === 0)
        return null;
    return tenants[0].id;
}
export async function GET(request) {
    try {
        const userId = request.nextUrl.searchParams.get('userId');
        const email = request.nextUrl.searchParams.get('email');
        let tenantId = null;
        if (userId) {
            tenantId = await getTenantId(userId);
        }
        else if (email) {
            tenantId = await getTenantIdByEmail(email);
        }
        if (!tenantId) {
            return NextResponse.json({ payments: [], message: 'Tenant not found.' });
        }
        const { data, error } = await supabaseAdmin
            .from('payments')
            .select('*')
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false });
        if (error)
            throw error;
        return NextResponse.json({ payments: data ?? [] });
    }
    catch (error) {
        return NextResponse.json({ payments: [], message: error.message ?? 'Unable to load payments.' }, { status: 500 });
    }
}
