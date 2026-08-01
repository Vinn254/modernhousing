import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

function decodeJWT(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    let payload = parts[1];
    payload = payload.replace(/-/g, '+').replace(/_/g, '/');
    while (payload.length % 4) payload += '=';
    try {
      return JSON.parse(atob(payload));
    } catch {
      return JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
    }
  } catch {
    return null;
  }
}

async function getAuthContext(request: NextRequest) {
  const cookie = request.headers.get('cookie') ?? '';
  const authorization = request.headers.get('authorization') ?? request.headers.get('Authorization');

  let sessionUser: any = null;

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
    } catch (e) {}
  }

  if (!sessionUser) {
    return { userId: undefined, organizationId: null };
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
    userId: sessionUser.id,
    organizationId: orgId,
  };
}

export async function GET(request: NextRequest) {
  try {
    const authContext = await getAuthContext(request);
    
    if (!authContext.userId) {
      return NextResponse.json({ documents: [], message: 'Not authorized.' }, { status: 401 });
    }

    // Get properties in this organization
    const { data: orgProps } = await supabaseAdmin
      .from('properties')
      .select('id')
      .eq('organization_id', authContext.organizationId ?? '');
    const propIds = new Set((orgProps ?? []).map((p: any) => p.id));

    // Get documents with tenant info
    const { data, error } = await supabaseAdmin
      .from('tenant_documents')
      .select('id, tenant_id, document_type, file_path, file_name, created_at, tenants!inner(id, full_name)')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ documents: [], message: error.message }, { status: 500 });
    }

    // Join with units to filter by property
    const { data: unitsData } = await supabaseAdmin
      .from('units')
      .select('id, property_id')
      .in('property_id', propIds.size > 0 ? Array.from(propIds) : ['none']);
    const unitToTenant: Record<string, string> = {};
    const tenantIds = new Set<string>();
    const docs = data ?? [];
    
    for (const doc of docs) {
      if (doc.tenant_id) tenantIds.add(doc.tenant_id);
    }
    
    if (tenantIds.size > 0) {
      const { data: tenantUnits } = await supabaseAdmin
        .from('tenants')
        .select('id, unit_id')
        .in('id', Array.from(tenantIds));
      (tenantUnits ?? []).forEach((t: any) => {
        unitToTenant[t.id] = t.unit_id;
      });
    }

    const unitIdsForFiltered = (unitsData ?? []).map((u: any) => u.id);
    const documents = (data ?? [])
      .filter((d: any) => {
        const unitId = unitToTenant[d.tenant_id];
        return unitId && unitIdsForFiltered.includes(unitId);
      })
      .map((d: any) => ({
        id: d.id,
        tenant_id: d.tenant_id,
        tenant_name: d.tenants?.full_name ?? 'Unknown Tenant',
        document_type: d.document_type,
        file_path: d.file_path,
        file_name: d.file_name,
        created_at: d.created_at,
      }));

    return NextResponse.json({ documents });
  } catch (error: any) {
    return NextResponse.json({ documents: [], message: error.message ?? 'Unable to load documents.' }, { status: 500 });
  }
}