import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase server environment variables');
}

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
      sessionUser = { id: decoded.sub, email: decoded.email };
    }
  }

  if (!sessionUser && cookie) {
    try {
      const supabaseAnon = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '', {
        global: { headers: { cookie } },
      });
      const { data: { user } } = await supabaseAnon.auth.getUser();
      sessionUser = user;
    } catch (e) {}
  }

  return { userId: sessionUser?.id ?? null, userEmail: sessionUser?.email ?? null };
}

export async function GET(request: NextRequest) {
  const authContext = await getAuthContext(request);

  if (!authContext.userId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role, organization_id')
    .eq('user_id', authContext.userId)
    .single();

  const documentId = request.nextUrl.searchParams.get('documentId');
  const tenantId = request.nextUrl.searchParams.get('tenantId');

  let query: any = supabaseAdmin.from('audit_trails').select(`
    *,
    documents(document_name, document_type)
  `).order('created_at', { ascending: false });

  if (documentId) {
    query = query.eq('document_id', documentId);
  }

  if (tenantId) {
    // Non-super-admin can only see their tenants
    if (profile?.role !== 'super_admin') {
      const { data: orgProps } = await supabaseAdmin
        .from('properties')
        .select('id')
        .eq('organization_id', profile?.organization_id);
      const propIds = (orgProps ?? []).map((p: any) => p.id);

      if (propIds.length > 0) {
        const { data: orgUnits } = await supabaseAdmin.from('units').select('id').in('property_id', propIds);
        const unitIds = (orgUnits ?? []).map((u: any) => u.id);
        const { data: tenantCheck } = await supabaseAdmin
          .from('tenants')
          .select('id')
          .eq('id', tenantId)
          .in('unit_id', unitIds)
          .maybeSingle();
        
        if (!tenantCheck) {
          return NextResponse.json({ message: 'Forbidden - Access denied to this tenant\'s audit trail' }, { status: 403 });
        }
      }
    }
    query = query.eq('tenant_id', tenantId);
  } else if (profile?.role !== 'super_admin') {
    // Landlords see only their tenants' audit trails
    const { data: orgProps } = await supabaseAdmin
      .from('properties')
      .select('id')
      .eq('organization_id', profile?.organization_id);
    const propIds = (orgProps ?? []).map((p: any) => p.id);

    if (propIds.length > 0) {
      const { data: orgUnits } = await supabaseAdmin.from('units').select('id').in('property_id', propIds);
      const unitIds = (orgUnits ?? []).map((u: any) => u.id);
      const { data: tenantIds } = await supabaseAdmin
        .from('tenants')
        .select('id')
        .in('unit_id', unitIds);
      const tenantIdValues = (tenantIds ?? []).map((t: any) => t.id);

      if (tenantIdValues.length > 0) {
        query = query.in('tenant_id', tenantIdValues);
      }
    }
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ auditTrails: data ?? [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    documentId,
    tenantId,
    tenantName,
    tenantEmail,
    tenantNationalId,
    signatureType,
    event,
    ipAddress,
    device,
    disclosureConsent
  } = body;

  const authContext = await getAuthContext(request);

  // Verify document belongs to tenant (for security)
  if (tenantId && !authContext.userId) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
  }

  const ip = ipAddress || request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '';
  const userAgent = request.headers.get('user-agent') || '';
  
  // Parse device from user agent
  let deviceInfo = device || 'Unknown Device';
  if (userAgent.includes('Chrome')) deviceInfo = 'Chrome via Desktop';
  else if (userAgent.includes('Mobile')) deviceInfo = 'Mobile Browser';

  // Check if audit trail exists for this document
  const { data: existingTrail } = await supabaseAdmin
    .from('audit_trails')
    .select('id, audit_events, sent_at, viewed_at, signed_at, completed_at')
    .eq('document_id', documentId)
    .maybeSingle();

  const now = new Date().toISOString();
  const newEvent = {
    action: event,
    timestamp: now,
    ip_address: ip,
    device: deviceInfo
  };

  if (existingTrail) {
    // Update existing audit trail
    const updatedEvents = [...(existingTrail.audit_events || []), newEvent];
    
    const updateData: any = {
      audit_events: updatedEvents,
      updated_at: now,
    };

    if (event === 'sent' && !existingTrail.sent_at) updateData.sent_at = now;
    if (event === 'viewed' && !existingTrail.viewed_at) updateData.viewed_at = now;
    if (event === 'signed' && !existingTrail.signed_at) updateData.signed_at = now;
    if (event === 'completed' && !existingTrail.completed_at) updateData.completed_at = now;

    const { data, error } = await supabaseAdmin
      .from('audit_trails')
      .update(updateData)
      .eq('id', existingTrail.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    return NextResponse.json({ auditTrail: data }, { status: 200 });
  } else {
    // Create new audit trail
    const createData: any = {
      document_id: documentId,
      tenant_id: tenantId,
      tenant_name: tenantName,
      tenant_email: tenantEmail,
      tenant_national_id: tenantNationalId,
      ip_address: ip,
      device: deviceInfo,
      signature_type: signatureType || 'Electronic Signature',
      security_authentication: 'Electronic Signature',
      audit_events: [newEvent],
      created_at: now,
    };

    if (event === 'sent') createData.sent_at = now;
    if (event === 'viewed') createData.viewed_at = now;
    if (event === 'signed') createData.signed_at = now;
    if (event === 'completed') createData.completed_at = now;
    if (disclosureConsent) createData.disclosure_consent = disclosureConsent;
    if (event === 'consent_accepted') createData.consent_accepted_at = now;

    const { data, error } = await supabaseAdmin
      .from('audit_trails')
      .insert(createData)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    return NextResponse.json({ auditTrail: data }, { status: 201 });
  }
}
