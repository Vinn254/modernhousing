import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    throw new Error('Missing Supabase server environment variables');
}
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
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
export async function GET(request) {
    try {
        const userId = request.nextUrl.searchParams.get('userId');
        const email = request.nextUrl.searchParams.get('email');
        if (!userId && !email) {
            return NextResponse.json({ message: 'User identifier required.' }, { status: 400 });
        }
        let tenantId = null;
        if (userId) {
            const { data: tenant } = await supabaseAdmin
                .from('tenants')
                .select('id')
                .eq('id', userId)
                .single();
            tenantId = tenant?.id;
        }
        if (!tenantId && email) {
            const { data: tenant } = await supabaseAdmin
                .from('tenants')
                .select('id')
                .eq('email', email)
                .single();
            tenantId = tenant?.id;
        }
        if (!tenantId) {
            return NextResponse.json({ agreement: null });
        }
        const { data, error } = await supabaseAdmin
            .from('tenant_agreements')
            .select('*')
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false })
            .limit(1);
        if (error)
            throw error;
        return NextResponse.json({ agreement: data?.[0] ?? null });
    }
    catch (error) {
        return NextResponse.json({ message: error.message ?? 'Unable to load agreement.' }, { status: 500 });
    }
}
export async function POST(request) {
    try {
        const body = await request.json();
        const { status } = body;
        const authorization = request.headers.get('authorization') ?? request.headers.get('Authorization');
        if (!status || !authorization?.startsWith('Bearer ')) {
            return NextResponse.json({ message: 'Status and auth required.' }, { status: 400 });
        }
        const token = authorization.split(' ')[1];
        const decoded = decodeJWT(token);
        const email = decoded?.email;
        if (!email) {
            return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 });
        }
        const { data: tenant } = await supabaseAdmin
            .from('tenants')
            .select('id')
            .eq('email', email)
            .single();
        if (!tenant) {
            return NextResponse.json({ message: 'Tenant not found.' }, { status: 404 });
        }
        const updates = { status };
        if (status === 'accepted') {
            updates.accepted_at = new Date().toISOString();
        }
        const { data, error } = await supabaseAdmin
            .from('tenant_agreements')
            .update(updates)
            .eq('tenant_id', tenant.id)
            .select()
            .single();
        if (error)
            throw error;
        // Notify landlord
        const { data: tenantWithUnit } = await supabaseAdmin
            .from('tenants')
            .select('unit_id')
            .eq('id', tenant.id)
            .maybeSingle();
        if (!tenantWithUnit?.unit_id) {
            return NextResponse.json({ agreement: data, message: `Agreement ${status}.` });
        }
        const { data: unitData } = await supabaseAdmin
            .from('units')
            .select('property_id')
            .eq('id', tenantWithUnit.unit_id)
            .maybeSingle();
        if (!unitData?.property_id) {
            return NextResponse.json({ agreement: data, message: `Agreement ${status}.` });
        }
        const { data: propData } = await supabaseAdmin
            .from('properties')
            .select('organization_id')
            .eq('id', unitData.property_id)
            .maybeSingle();
        const orgId = propData?.organization_id;
        if (orgId) {
            const { data: admin } = await supabaseAdmin
                .from('profiles')
                .select('email')
                .eq('organization_id', orgId)
                .single();
            if (admin?.email) {
                await supabaseAdmin.from('notifications').insert({
                    recipient: 'project_manager',
                    admin_email: admin.email,
                    type: 'agreement_ack',
                    message: `Tenant has ${status} the tenancy agreement.`,
                    status: 'sent',
                    created_at: new Date().toISOString(),
                });
            }
        }
        return NextResponse.json({ agreement: data, message: `Agreement ${status}.` });
    }
    catch (error) {
        return NextResponse.json({ message: error.message ?? 'Unable to update agreement.' }, { status: 500 });
    }
}
