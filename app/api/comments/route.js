import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { badRequest, isMissingTableError, requestError } from '../../../lib/supabaseAdmin';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase server environment variables');
}
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
async function getFallbackComments(propertyId, tenantId) {
    let tenantIds = null;
    if (propertyId) {
        const { data: tenants, error: tenantsError } = await supabaseAdmin
            .from('tenants')
            .select('id, units(property_id)')
            .eq('units.property_id', propertyId);
        if (tenantsError)
            throw tenantsError;
        tenantIds = (tenants ?? []).map((tenant) => tenant.id);
    }
    if (tenantId) {
        tenantIds = tenantIds ? tenantIds.filter((id) => id === tenantId) : [tenantId];
    }
    const query = supabaseAdmin
        .from('payments')
        .select('*, tenants(full_name, email)')
        .eq('transaction_type', 'complaint')
        .order('created_at', { ascending: false });
    if (tenantIds && tenantIds.length > 0) {
        query.in('tenant_id', tenantIds);
    }
    const { data, error } = await query;
    if (error)
        throw error;
    return (data ?? []).map((item) => ({
        ...item,
        tenant: item.tenants?.full_name ?? '',
        tenant_email: item.tenants?.email ?? '',
        message: item.description ?? '',
        status: item.status ?? 'open',
    }));
}
export async function GET(request) {
    try {
        const propertyId = request.nextUrl.searchParams.get('propertyId');
        const query = supabaseAdmin
            .from('comments')
            .select('*, tenants(full_name, email)')
            .order('created_at', { ascending: false });
        if (propertyId) {
            query.eq('property_id', propertyId);
        }
        const tenantId = request.nextUrl.searchParams.get('tenantId') ?? request.nextUrl.searchParams.get('tenant_id');
        const { data, error } = await query;
        if (error) {
            if (isMissingTableError(error, 'comments')) {
                return NextResponse.json({ comments: await getFallbackComments(propertyId || undefined, tenantId || undefined) });
            }
            throw error;
        }
        return NextResponse.json({ comments: data ?? [] });
    }
    catch (error) {
        return requestError(error);
    }
}
export async function POST(request) {
    try {
        const body = await request.json();
        const tenantId = String(body.tenantId ?? body.tenant_id ?? '').trim();
        const propertyId = String(body.propertyId ?? body.property_id ?? '').trim();
        const recipientRole = String(body.recipientRole ?? body.recipient_role ?? 'landlord').trim();
        const recipientId = String(body.recipientId ?? body.recipient_id ?? '').trim() || null;
        const message = String(body.message ?? '').trim();
        if (!tenantId || !propertyId || !message) {
            return badRequest('Tenant, property, and message are required.');
        }
        if (!['landlord', 'agent'].includes(recipientRole)) {
            return badRequest('Recipient must be landlord or agent.');
        }
        const { data, error } = await supabaseAdmin
            .from('comments')
            .insert({
            tenant_id: tenantId,
            property_id: propertyId,
            recipient_role: recipientRole,
            recipient_id: recipientId,
            message,
            status: 'open',
        })
            .select('*, tenants(full_name, email)')
            .single();
        if (error) {
            if (isMissingTableError(error, 'comments')) {
                const { data: fallbackData, error: fallbackError } = await supabaseAdmin
                    .from('payments')
                    .insert({
                    tenant_id: tenantId,
                    description: message,
                    transaction_type: 'complaint',
                    amount: 0,
                    balance_remaining: 0,
                    paid_at: new Date().toISOString(),
                })
                    .select('*, tenants(full_name, email)')
                    .single();
                if (fallbackError)
                    throw fallbackError;
                return NextResponse.json({ comment: fallbackData, message: 'Comment sent.' }, { status: 201 });
            }
            throw error;
        }
        return NextResponse.json({ comment: data, message: 'Comment sent.' }, { status: 201 });
    }
    catch (error) {
        return NextResponse.json({ message: error.message ?? 'Unable to send comment.' }, { status: 500 });
    }
}
