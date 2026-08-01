import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { adminRequest, badRequest } from '../../../lib/supabaseAdmin';
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
function getBaseUrl() {
    const host = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL ?? 'http://localhost:3000';
    return host.replace(/\/$/, '');
}
export async function POST(request) {
    try {
        const body = await request.json();
        const userId = String(body.userId ?? '').trim();
        const organizationName = String(body.organizationName ?? '').trim();
        const managerName = String(body.managerName ?? '').trim();
        const email = String(body.email ?? '').trim();
        const plan = String(body.plan ?? 'monthly').trim();
        if (!userId || !organizationName || !managerName || !email) {
            return badRequest('Missing registration fields.');
        }
        if (!planAmounts[plan]) {
            return badRequest('Invalid subscription plan.');
        }
        const organization = await supabaseAdmin
            .from('organizations')
            .insert({ name: organizationName, details: 'Created by project manager signup flow' })
            .select()
            .single();
        if (organization.error)
            throw organization.error;
        const profile = await supabaseAdmin
            .from('profiles')
            .insert({
            user_id: userId,
            full_name: managerName,
            email,
            role: 'project_manager',
            organization_id: organization.data.id,
            status: 'pending',
        })
            .select()
            .single();
        if (profile.error)
            throw profile.error;
        const baseUrl = getBaseUrl();
        const subscriptionUrl = `${baseUrl}/api/subscriptions`;
        const subscriptionResponse = await fetch(subscriptionUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                adminName: managerName,
                email,
                plan,
                adminId: userId,
                status: 'pending',
                start_date: new Date().toISOString().slice(0, 10),
                expiry_date: todayPlus(plan),
            }),
        });
        const text = await subscriptionResponse.text();
        let subscriptionPayload = {};
        if (text) {
            try {
                subscriptionPayload = JSON.parse(text);
            }
            catch {
                subscriptionPayload = {};
            }
        }
        if (!subscriptionResponse.ok) {
            console.warn('Subscription creation failed:', subscriptionPayload.message ?? subscriptionResponse.statusText);
        }
        await adminRequest(`/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
            method: 'PUT',
            body: JSON.stringify({
                user_metadata: {
                    full_name: managerName,
                    role: 'project_manager',
                    status: 'pending',
                    organization_id: organization.data.id,
                },
            }),
        });
        return NextResponse.json({ message: 'Project manager registered with subscription.', subscription: subscriptionPayload.subscription ?? null }, { status: 201 });
    }
    catch (error) {
        return NextResponse.json({ message: error.message ?? 'Unable to register project manager.' }, { status: 500 });
    }
}
