import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase server environment variables');
}
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
const nonPaymentTypes = ['complaint', 'notification'];
function toNumber(value) {
    const numeric = Number(value ?? 0);
    return Number.isNaN(numeric) ? 0 : numeric;
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
        return { isSuperAdmin: false, userId: undefined, organizationId: null, sessionUser: null };
    }
    const userMetadata = sessionUser.user_metadata || {};
    let orgId = userMetadata.organization_id ?? null;
    if (!orgId && sessionUser.email) {
        const { data: profileByEmail } = await supabaseAdmin
            .from('profiles')
            .select('organization_id')
            .eq('email', sessionUser.email)
            .single();
        orgId = profileByEmail?.organization_id ?? null;
    }
    return {
        isSuperAdmin: userMetadata.role === 'super_admin',
        userId: sessionUser.id,
        organizationId: orgId,
        sessionUser,
    };
}
export async function GET(request) {
    try {
        const authContext = await getAuthContext(request);
        const urlPropertyId = request.nextUrl.searchParams.get('propertyId');
        const userMetadata = authContext.sessionUser?.user_metadata || {};
        const agentPropertyId = userMetadata?.property_id;
        const effectivePropertyId = urlPropertyId || agentPropertyId;
        const isAgent = userMetadata?.role === 'agent';
        const isSuperAdmin = authContext.isSuperAdmin;
        let propertiesQuery = supabaseAdmin.from('properties').select('id, name');
        let unitsQuery = supabaseAdmin.from('units').select('id, occupancy_status, property_id');
        let tenantsQuery = supabaseAdmin.from('tenants').select('id, lease_start, deposit_amount, unit_id');
        let paymentsQuery = supabaseAdmin.from('payments').select('id, tenant_id, amount, balance_remaining, created_at');
        let subscriptionsQuery = supabaseAdmin.from('subscriptions').select('id, admin_id, status');
        // For landlords, filter by properties they CREATED
        let propIds = [];
        if (!isAgent && !isSuperAdmin && authContext.userId) {
            const { data: userProps } = await supabaseAdmin.from('properties').select('id').eq('created_by', authContext.userId);
            propIds = (userProps ?? []).map((p) => p.id);
            if (propIds.length > 0) {
                propertiesQuery = propertiesQuery.in('id', propIds);
                unitsQuery = unitsQuery.in('property_id', propIds);
                const { data: unitsInOrg } = await supabaseAdmin.from('units').select('id').in('property_id', propIds);
                const unitIds = (unitsInOrg ?? []).map((u) => u.id);
                if (unitIds.length > 0) {
                    tenantsQuery = tenantsQuery.in('unit_id', unitIds);
                    paymentsQuery = paymentsQuery.in('tenant_id', (await supabaseAdmin.from('tenants').select('id').in('unit_id', unitIds)).data?.map((t) => t.id) ?? []);
                }
            }
            // If no properties found for this landlord, return empty
            if (propIds.length === 0 && !effectivePropertyId) {
                propertiesQuery = propertiesQuery.eq('id', 'none');
                unitsQuery = unitsQuery.eq('property_id', 'none');
                tenantsQuery = tenantsQuery.eq('unit_id', 'none');
                paymentsQuery = paymentsQuery.eq('tenant_id', 'none');
            }
        }
        else if (effectivePropertyId) {
            propertiesQuery = propertiesQuery.eq('id', effectivePropertyId);
            unitsQuery = unitsQuery.eq('property_id', effectivePropertyId);
            const { data: unitsInProp } = await supabaseAdmin.from('units').select('id').eq('property_id', effectivePropertyId);
            const unitIds = (unitsInProp ?? []).map((u) => u.id);
            if (unitIds.length > 0) {
                tenantsQuery = tenantsQuery.in('unit_id', unitIds);
                paymentsQuery = paymentsQuery.in('tenant_id', (await supabaseAdmin.from('tenants').select('id').in('unit_id', unitIds)).data?.map((t) => t.id) ?? []);
            }
        }
        const [{ data: propertiesData }, { data: unitsData }, { data: tenantsData }, { data: paymentsData }, { data: subscriptionsData }, { data: unitsForVacant }, { data: tenantsForOwed }] = await Promise.all([
            propertiesQuery,
            unitsQuery,
            tenantsQuery,
            paymentsQuery,
            subscriptionsQuery,
            propIds.length > 0
                ? supabaseAdmin.from('units').select('id, unit_number, occupancy_status, rent_amount, property_id').eq('occupancy_status', 'vacant').in('property_id', propIds)
                : supabaseAdmin.from('units').select('id').eq('property_id', 'none'),
            supabaseAdmin.from('tenants').select(`
        id, full_name, email, lease_start,
        units!inner(unit_number, rent_amount, property_id)
      `).then(async (result) => {
                if (propIds.length > 0) {
                    const unitIds = (await supabaseAdmin.from('units').select('id').in('property_id', propIds)).data?.map((u) => u.id) ?? [];
                    return await supabaseAdmin.from('tenants').select(`
            id, full_name, email, lease_start,
            units!inner(unit_number, rent_amount, property_id)
          `).in('unit_id', unitIds);
                }
                return { data: [] };
            }),
        ]);
        const allTenants = tenantsData ?? [];
        const allUnits = unitsData ?? [];
        const occupiedUnits = (allUnits ?? []).filter((u) => u.occupancy_status === 'occupied').length;
        const vacantUnits = (allUnits ?? []).length - occupiedUnits;
        // Filter vacant units by properties user created
        const vacantUnitsFiltered = (unitsForVacant ?? []).filter((u) => propIds.includes(u.property_id));
        // Filter tenants for rent owed by properties user created
        const tenantsForOwedFiltered = (tenantsForOwed ?? []).filter((t) => propIds.includes(t.units?.property_id));
        const propertyCount = effectivePropertyId ? 1 : (propertiesData?.length ?? 0);
        const financialPayments = (paymentsData ?? []).filter((p) => !nonPaymentTypes.includes(p.transaction_type));
        const totalPayments = financialPayments.reduce((sum, payment) => sum + toNumber(payment.amount), 0);
        const totalBalance = financialPayments.reduce((sum, payment) => sum + toNumber(payment.balance_remaining), 0);
        const paymentsByTenant = new Map();
        financialPayments.forEach((payment) => {
            const tenantId = String(payment.tenant_id ?? '');
            if (!tenantId)
                return;
            const current = paymentsByTenant.get(tenantId) ?? 0;
            paymentsByTenant.set(tenantId, current + 1);
        });
        const tenantsWithAnalytics = allTenants.map((tenant) => {
            const firstPayment = financialPayments
                .filter((payment) => payment.tenant_id === tenant.id)
                .sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime())[0];
            const startDate = firstPayment?.created_at ?? tenant.lease_start;
            const dueDate = startDate ? new Date(new Date(startDate).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) : '';
            const paymentCount = paymentsByTenant.get(String(tenant.id)) ?? 0;
            return {
                id: tenant.id,
                payment_count: paymentCount,
                due_date: dueDate,
            };
        });
        const vacantUnitsList = vacantUnitsFiltered.map((u) => ({
            unit_number: u.unit_number,
            property_name: (propertiesData ?? []).find((p) => p.id === u.property_id)?.name ?? '—',
            rent_amount: u.rent_amount ?? 0,
        }));
        const rentOwedByTenant = tenantsForOwedFiltered.map((tenant) => {
            const tenantPayments = (paymentsData ?? []).filter((p) => p.tenant_id === tenant.id);
            const totalPaid = tenantPayments.reduce((sum, p) => sum + toNumber(p.amount), 0);
            const expectedRent = toNumber(tenant.units?.rent_amount ?? 0);
            const balance = tenantPayments.reduce((sum, p) => sum + toNumber(p.balance_remaining), 0);
            return {
                id: tenant.id,
                full_name: tenant.full_name,
                email: tenant.email,
                unit: tenant.units?.unit_number ?? '—',
                property: tenant.units?.properties?.name ?? '—',
                total_paid: totalPaid,
                rent_amount: expectedRent,
                balance_remaining: balance,
                last_payment: tenantPayments.sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())[0]?.created_at ?? null,
            };
        });
        return NextResponse.json({
            properties: propertyCount,
            agents: 0,
            tenants: allTenants.length,
            total_payments: totalPayments,
            total_balance: totalBalance,
            occupiedUnits,
            vacantUnits,
            vacantUnitsList,
            rentOwedByTenant,
            subscribedLandlords: 0,
            totalLandlords: 0,
            totalPayments: paymentsData?.length ?? 0,
            tenants_with_analytics: tenantsWithAnalytics,
        });
    }
    catch (error) {
        return NextResponse.json({
            properties: 0,
            agents: 0,
            tenants: 0,
            total_payments: 0,
            total_balance: 0,
            occupiedUnits: 0,
            vacantUnits: 0,
            subscribedLandlords: 0,
            totalLandlords: 0,
            totalPayments: 0,
            tenants_with_analytics: [],
            message: error instanceof Error ? error.message : 'Unable to load dashboard',
        });
    }
}
