import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { badRequest, isMissingTableError, requestError } from '../../../lib/supabaseAdmin';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase server environment variables');
}
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
const planAmounts = {
    monthly: 2500,
    quarterly: 5000,
    yearly: 6000,
};
function todayPlus(plan) {
    const now = new Date();
    if (plan === 'quarterly')
        now.setMonth(now.getMonth() + 3);
    if (plan === 'yearly')
        now.setFullYear(now.getFullYear() + 1);
    else
        now.setMonth(now.getMonth() + 1);
    return now.toISOString().slice(0, 10);
}
function normalizeSubscription(item) {
    return {
        id: item.id,
        admin_id: item.admin_id ?? '',
        admin_name: item.admin_name ?? item.admin ?? 'Administrator',
        email: item.email ?? '',
        plan: item.plan ?? 'monthly',
        amount: Number(item.amount ?? planAmounts[item.plan ?? 'monthly'] ?? 0),
        status: item.status ?? 'pending',
        start_date: item.start_date ?? new Date().toISOString().slice(0, 10),
        expiry_date: item.expiry_date ?? todayPlus(item.plan ?? 'monthly'),
        paid_at: item.paid_at ?? '',
        created_at: item.created_at ?? '',
    };
}
export async function GET() {
    try {
        const { data, error } = await supabaseAdmin.from('subscriptions').select('*').order('created_at', { ascending: false });
        if (error) {
            if (isMissingTableError(error, 'subscriptions'))
                return NextResponse.json({ subscriptions: [] });
            throw error;
        }
        return NextResponse.json({ subscriptions: (data ?? []).map(normalizeSubscription) });
    }
    catch (error) {
        return requestError(error);
    }
}
export async function POST(request) {
    try {
        const body = await request.json();
        const adminName = String(body.adminName ?? body.admin_name ?? '').trim();
        const email = String(body.email ?? '').trim();
        const plan = String(body.plan ?? 'monthly').trim();
        const adminId = String(body.adminId ?? body.admin_id ?? '').trim() || null;
        const status = String(body.status ?? 'pending').trim();
        const startDate = String(body.start_date ?? new Date().toISOString().slice(0, 10)).trim();
        const expiryDate = String(body.expiry_date ?? todayPlus(plan)).trim();
        if (!adminName || !email || !planAmounts[plan]) {
            return badRequest('Administrator name, email, and valid plan are required.');
        }
        const payload = {
            admin_id: adminId,
            admin_name: adminName,
            email,
            plan,
            amount: planAmounts[plan],
            status,
            start_date: startDate,
            expiry_date: expiryDate,
            paid_at: status === 'paid' ? new Date().toISOString() : null,
        };
        const { data, error } = await supabaseAdmin.from('subscriptions').insert(payload).select('*').single();
        if (error) {
            if (isMissingTableError(error, 'subscriptions')) {
                return badRequest('Create the subscriptions table in Supabase before recording payments.');
            }
            throw error;
        }
        return NextResponse.json({ subscription: normalizeSubscription(data), message: 'Subscription payment recorded.' }, { status: 201 });
    }
    catch (error) {
        return NextResponse.json({ message: error.message ?? 'Unable to record subscription payment.' }, { status: 500 });
    }
}
export async function PATCH(request) {
    try {
        const body = await request.json();
        const id = String(body.id ?? '').trim();
        const status = String(body.status ?? 'pending').trim();
        if (!id)
            return badRequest('Subscription ID is required.');
        if (!['paid', 'pending', 'overdue', 'expired', 'active'].includes(status))
            return badRequest('Invalid subscription status.');
        const updates = { status };
        if (status === 'paid') {
            updates.paid_at = new Date().toISOString();
        }
        const { data, error } = await supabaseAdmin.from('subscriptions').update(updates).eq('id', id).select('*').single();
        if (error)
            throw error;
        return NextResponse.json({ subscription: normalizeSubscription(data) });
    }
    catch (error) {
        return NextResponse.json({ message: error.message ?? 'Unable to update subscription.' }, { status: 500 });
    }
}
