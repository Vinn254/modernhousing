import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logAuditEvent } from '../../../lib/auditLogger';
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
async function getAuthContext(request) {
    const cookie = request.headers.get('cookie') ?? '';
    const authorization = request.headers.get('authorization') ?? request.headers.get('Authorization');
    let sessionUser = null;
    // Method 1: Try Bearer token auth with JWT decoding
    if (authorization?.startsWith('Bearer ')) {
        const token = authorization.split(' ')[1];
        const decoded = decodeJWT(token);
        if (decoded?.sub) {
            sessionUser = {
                id: decoded.sub,
                email: decoded.email,
                user_metadata: decoded.user_metadata || {},
            };
        }
    }
    // Method 2: Try cookie-based session
    if (!sessionUser && cookie) {
        try {
            const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
                global: { headers: { cookie } },
            });
            const { data: { user } } = await supabaseAuth.auth.getUser();
            sessionUser = user;
        }
        catch (e) { }
    }
    // Method 3: Try session from cookie (fallback)
    if (!sessionUser && cookie) {
        try {
            const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
                global: { headers: { cookie } },
            });
            const { data: { session } } = await supabaseAuth.auth.getSession();
            sessionUser = session?.user;
        }
        catch (e) { }
    }
    if (!sessionUser) {
        return { isSuperAdmin: false, profile: null, organizationId: null };
    }
    const userMetadata = sessionUser.user_metadata || {};
    const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id, user_id, organization_id, role, full_name, email, user_metadata')
        .eq('user_id', sessionUser.id)
        .single();
    let orgId = profile?.organization_id ?? userMetadata.organization_id ?? null;
    return {
        isSuperAdmin: profile?.role === 'super_admin' || userMetadata.role === 'super_admin',
        profile,
        organizationId: orgId,
        sessionUser,
        userId: sessionUser?.id,
        userEmail: sessionUser?.email,
    };
}
export async function GET(request) {
    try {
        const authContext = await getAuthContext(request);
        const propertyId = request.nextUrl.searchParams.get('propertyId');
        // Get all properties the user owns/assigned to
        let propertyIds = [];
        if (authContext.isSuperAdmin) {
            // Super admin - can see all units
        }
        else {
            const sessionUser = authContext.sessionUser;
            const userMetadata = sessionUser?.user_metadata || authContext.profile?.user_metadata || {};
            // Agents: get units from assigned property
            if (userMetadata?.property_id) {
                propertyIds.push(userMetadata.property_id);
            }
            // Landlords: filter by created_by (only properties they CREATED)
            else if (authContext.userId) {
                const { data: userProps } = await supabaseAdmin
                    .from('properties')
                    .select('id')
                    .eq('created_by', authContext.userId);
                propertyIds = (userProps ?? []).map((p) => p.id);
            }
            // If no properties found, return empty
            if (propertyIds.length === 0 && !propertyId) {
                return NextResponse.json({ units: [] });
            }
        }
        let query = supabaseAdmin
            .from('units')
            .select(`
        id,
        property_id,
        unit_number,
        rent_amount,
        occupancy_status,
        created_at,
        tenants(id, full_name, email, lease_start, lease_end)
      `);
        if (propertyId) {
            query = query.eq('property_id', propertyId);
        }
        else if (propertyIds.length > 0) {
            query = query.in('property_id', propertyIds);
        }
        else {
            return NextResponse.json({ units: [] });
        }
        const { data: units, error } = await query.order('unit_number', { ascending: true });
        if (error) {
            return NextResponse.json({ message: error.message }, { status: 500 });
        }
        const processedUnits = (units ?? []).map((unit) => ({
            id: unit.id,
            property_id: unit.property_id,
            unit_number: unit.unit_number,
            rent_amount: Number(unit.rent_amount ?? 0),
            occupancy_status: unit.occupancy_status ?? 'vacant',
            unit_type: unit.unit_type ?? null,
            created_at: unit.created_at,
            previous_water_reading: unit.previous_water_reading ?? null,
            current_water_reading: unit.current_water_reading ?? null,
            last_meter_update: unit.last_meter_update ?? null,
            tenant: unit.tenants?.full_name ?? null,
            tenant_email: unit.tenants?.email ?? null,
            tenant_id: unit.tenants?.id ?? null,
            lease_start: unit.tenants?.lease_start ?? null,
            lease_end: unit.tenants?.lease_end ?? null,
        }));
        return NextResponse.json({ units: processedUnits });
    }
    catch (error) {
        return NextResponse.json({ message: error.message ?? 'Unable to fetch units.' }, { status: 500 });
    }
}
export async function POST(request) {
    try {
        const body = await request.json();
        const { propertyId, unitNumber, rentAmount, unitType, size, agentEmail, occupancyStatus } = body;
        if (!propertyId || !unitNumber) {
            return NextResponse.json({ message: 'Property ID and unit number are required.' }, { status: 400 });
        }
        const authContext = await getAuthContext(request);
        const userMetadata = authContext.sessionUser?.user_metadata || authContext.profile?.user_metadata || {};
        if (!authContext.isSuperAdmin) {
            // Verify property exists and belongs to this user (created by them)
            const { data: prop } = await supabaseAdmin
                .from('properties')
                .select('id, created_by')
                .eq('id', propertyId)
                .maybeSingle();
            if (!prop) {
                return NextResponse.json({ message: 'Property not found.' }, { status: 404 });
            }
            // Landlords: can only add units to properties they CREATED
            if (prop.created_by !== authContext.userId) {
                return NextResponse.json({ message: 'You can only add units to properties you created.' }, { status: 403 });
            }
            // Agents: can only add units to their assigned property
            if (userMetadata?.property_id && userMetadata.property_id !== propertyId) {
                return NextResponse.json({ message: 'You can only add units to your assigned property.' }, { status: 403 });
            }
        }
        const insertData = {
            property_id: propertyId,
            unit_number: unitNumber,
            rent_amount: rentAmount ?? 0,
            size,
            agent_email: agentEmail,
            occupancy_status: occupancyStatus ?? 'vacant',
        };
        if (unitType)
            insertData.unit_type = unitType;
        const result = await supabaseAdmin.from('units').insert(insertData).select().single();
        if (result.error) {
            return NextResponse.json({ message: result.error.message }, { status: 500 });
        }
        // Log audit
        await logAuditEvent(authContext.userId, authContext.userEmail, 'create', 'unit', result.data?.id, { unit_number: unitNumber, property_id: propertyId, rent_amount: rentAmount });
        return NextResponse.json({ unit: result.data, message: 'Unit created.' }, { status: 201 });
    }
    catch (error) {
        return NextResponse.json({ message: error.message ?? 'Unable to create unit.' }, { status: 500 });
    }
}
export async function PATCH(request) {
    try {
        const id = request.nextUrl.searchParams.get('id');
        const body = await request.json().catch(() => ({}));
        const { unitNumber, rentAmount, size, agentEmail, occupancyStatus, unitType } = body || {};
        if (!id) {
            return NextResponse.json({ message: 'Unit ID is required.', receivedId: id }, { status: 400 });
        }
        const authContext = await getAuthContext(request);
        const userMetadata = authContext.sessionUser?.user_metadata || authContext.profile?.user_metadata || {};
        if (!authContext.isSuperAdmin) {
            // Check if user is an agent and unit belongs to their assigned property
            if (userMetadata?.property_id) {
                const { data: unitData } = await supabaseAdmin
                    .from('units')
                    .select('property_id')
                    .eq('id', id)
                    .eq('property_id', userMetadata.property_id)
                    .maybeSingle();
                if (!unitData) {
                    return NextResponse.json({ message: 'You can only manage units in your assigned property.' }, { status: 403 });
                }
            }
            // Landlords: can only modify units in properties they CREATED
            else if (authContext.userId) {
                const { data: unitData } = await supabaseAdmin
                    .from('units')
                    .select('property_id, properties!inner(created_by)')
                    .eq('id', id)
                    .eq('properties.created_by', authContext.userId)
                    .maybeSingle();
                if (!unitData) {
                    return NextResponse.json({ message: 'You can only manage units in properties you created.' }, { status: 403 });
                }
            }
        }
        const updates = {};
        if (unitNumber !== undefined)
            updates.unit_number = unitNumber;
        if (rentAmount !== undefined)
            updates.rent_amount = rentAmount;
        if (size !== undefined)
            updates.size = size;
        if (agentEmail !== undefined)
            updates.agent_email = agentEmail;
        if (occupancyStatus !== undefined)
            updates.occupancy_status = occupancyStatus;
        if (unitType !== undefined)
            updates.unit_type = unitType;
        const result = await supabaseAdmin.from('units').update(updates).eq('id', id).select().single();
        if (result.error) {
            return NextResponse.json({ message: result.error.message }, { status: 500 });
        }
        // Log audit
        await logAuditEvent(authContext.userId, authContext.userEmail, 'update', 'unit', id, { unit_number: unitNumber, rent_amount: rentAmount, occupancy_status: occupancyStatus });
        return NextResponse.json({ unit: result.data, message: 'Unit updated.' });
    }
    catch (error) {
        console.error('PATCH /api/units error:', error);
        return NextResponse.json({ message: error.message ?? 'Unable to update unit.' }, { status: 500 });
    }
}
export async function DELETE(request) {
    try {
        const id = request.nextUrl.searchParams.get('id');
        if (!id) {
            return NextResponse.json({ message: 'Unit ID is required.' }, { status: 400 });
        }
        const authContext = await getAuthContext(request);
        const userMetadata = authContext.sessionUser?.user_metadata || authContext.profile?.user_metadata || {};
        if (!authContext.isSuperAdmin) {
            // Agents: can only delete units in their assigned property
            if (userMetadata?.property_id) {
                const { data: unitProp } = await supabaseAdmin
                    .from('units')
                    .select('property_id')
                    .eq('id', id)
                    .eq('property_id', userMetadata.property_id)
                    .maybeSingle();
                if (!unitProp) {
                    return NextResponse.json({ message: 'You can only manage units in your assigned property.' }, { status: 403 });
                }
            }
            // Landlords: can only delete units in properties they CREATED
            else if (authContext.userId) {
                const { data: unitProp } = await supabaseAdmin
                    .from('units')
                    .select('property_id, properties!inner(created_by)')
                    .eq('id', id)
                    .eq('properties.created_by', authContext.userId)
                    .maybeSingle();
                if (!unitProp) {
                    return NextResponse.json({ message: 'You can only manage units in properties you created.' }, { status: 403 });
                }
            }
        }
        const result = await supabaseAdmin.from('units').delete().eq('id', id);
        if (result.error) {
            return NextResponse.json({ message: result.error.message }, { status: 500 });
        }
        // Log audit
        await logAuditEvent(authContext.userId, authContext.userEmail, 'delete', 'unit', id, { unitId: id });
        return NextResponse.json({ message: 'Unit deleted.' });
    }
    catch (error) {
        return NextResponse.json({ message: error.message ?? 'Unable to delete unit.' }, { status: 500 });
    }
}
