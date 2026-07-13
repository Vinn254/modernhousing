import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

function getSupabaseAdmin() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase server environment variables');
  }
  return createClient(supabaseUrl, serviceRoleKey);
}

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

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

async function getAuthContext(request: NextRequest) {
  const client = getSupabaseAdmin();
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
    return { isSuperAdmin: false, userId: undefined, organizationId: null, tenantId: null, userMetadata: null };
  }

  const userMetadata = sessionUser.user_metadata || {};
  let orgId = userMetadata.organization_id ?? null;
  const tenantId = userMetadata.tenant_id ?? null;

  if (!orgId && sessionUser.email) {
    const { data: profileByEmail } = await client
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
    tenantId,
    userMetadata,
  };
}

export async function GET(request: NextRequest) {
  try {
    const client = getSupabaseAdmin();
    const authContext = await getAuthContext(request);
    const tenantEmail = request.nextUrl.searchParams.get('email');
    const tenantIdParam = request.nextUrl.searchParams.get('tenantId');

    // For tenants - get their own documents
    if (authContext.tenantId || tenantIdParam) {
      const effectiveTenantId = authContext.tenantId || tenantIdParam;
      const { data, error } = await client
        .from('documents')
        .select('*')
        .eq('tenant_id', effectiveTenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return NextResponse.json({ documents: data ?? [] });
    }

    // For agents - get documents for their property's tenants
    const userMetadata = authContext.userMetadata || {};
    const isAgent = userMetadata.role === 'agent';
    const agentPropertyId = isAgent ? userMetadata.property_id : null;

    if (isAgent && agentPropertyId) {
      const { data: units } = await client
        .from('units')
        .select('id')
        .eq('property_id', agentPropertyId);
      const unitIds = (units ?? []).map((u: any) => u.id);

      if (unitIds.length > 0) {
        const { data: tenantIds } = await client
          .from('tenants')
          .select('id')
          .in('unit_id', unitIds);
        const tenantIdValues = (tenantIds ?? []).map((t: any) => t.id);

        if (tenantIdValues.length > 0) {
          const { data, error } = await client
            .from('documents')
            .select(`*, tenants(full_name, email, units(unit_number, properties(name)))`)
            .in('tenant_id', tenantIdValues)
            .order('created_at', { ascending: false });

          if (error) throw error;

          const documents = (data ?? []).map((doc: any) => ({
            id: doc.id,
            tenant_id: doc.tenant_id,
            tenant_name: doc.tenants?.full_name ?? '',
            property_name: doc.tenants?.units?.properties?.name ?? '',
            unit_number: doc.tenants?.units?.unit_number ?? '',
            document_name: doc.document_name,
            document_url: doc.document_url,
            document_type: doc.document_type,
            status: doc.status,
            notes: doc.notes,
            created_at: doc.created_at,
          }));

          return NextResponse.json({ documents });
        }
      }
      return NextResponse.json({ documents: [] });
    }

    // For landlords - get documents for their tenants (organization-scoped)
    if (!authContext.isSuperAdmin && authContext.organizationId) {
      const { data: orgProps } = await client
        .from('properties')
        .select('id')
        .eq('organization_id', authContext.organizationId);
      const propIds = (orgProps ?? []).map((p: any) => p.id);

      if (propIds.length > 0) {
        const { data: orgUnits } = await client
          .from('units')
          .select('id')
          .in('property_id', propIds);
        const unitIds = (orgUnits ?? []).map((u: any) => u.id);

        if (unitIds.length > 0) {
          const { data: tenantIds } = await client
            .from('tenants')
            .select('id')
            .in('unit_id', unitIds);
          const tenantIdValues = (tenantIds ?? []).map((t: any) => t.id);

          if (tenantIdValues.length > 0) {
            const { data, error } = await client
              .from('documents')
              .select(`*, tenants(full_name, email, units(unit_number, properties(name)))`)
              .in('tenant_id', tenantIdValues)
              .order('created_at', { ascending: false });

            if (error) throw error;

            const documents = (data ?? []).map((doc: any) => ({
              id: doc.id,
              tenant_id: doc.tenant_id,
              tenant_name: doc.tenants?.full_name ?? '',
              property_name: doc.tenants?.units?.properties?.name ?? '',
              unit_number: doc.tenants?.units?.unit_number ?? '',
              document_name: doc.document_name,
              document_url: doc.document_url,
              document_type: doc.document_type,
              status: doc.status,
              notes: doc.notes,
              created_at: doc.created_at,
            }));

            return NextResponse.json({ documents });
          }
        }
      }
      return NextResponse.json({ documents: [] });
    }

    // Super admin - get all documents
    const { data, error } = await client
      .from('documents')
      .select(`*, tenants(full_name, email, units(unit_number, properties(name)))`)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const documents = (data ?? []).map((doc: any) => ({
      id: doc.id,
      tenant_id: doc.tenant_id,
      tenant_name: doc.tenants?.full_name ?? '',
      property_name: doc.tenants?.units?.properties?.name ?? '',
      unit_number: doc.tenants?.units?.unit_number ?? '',
      document_name: doc.document_name,
      document_url: doc.document_url,
      document_type: doc.document_type,
      status: doc.status,
      notes: doc.notes,
      created_at: doc.created_at,
    }));

    return NextResponse.json({ documents });
  } catch (error: any) {
    return NextResponse.json({ documents: [], message: error.message ?? 'Unable to load documents.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const client = getSupabaseAdmin();
  const authContext = await getAuthContext(request);

  if (!authContext.userId) {
    return NextResponse.json({ message: 'Authentication required.' }, { status: 401 });
  }

  // Handle multipart form data for file uploads
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
    try {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const tenantId = formData.get('tenantId') as string;
      const documentType = (formData.get('documentType') as string) || 'agreement';
      const documentName = (formData.get('documentName') as string) || documentType;

      if (!file || !tenantId) {
        return NextResponse.json({ message: 'File and tenant ID are required.' }, { status: 400 });
      }

      // Verify tenant belongs to landlord's organization
      if (!authContext.isSuperAdmin && authContext.organizationId) {
        const { data: orgProps } = await client
          .from('properties')
          .select('id')
          .eq('organization_id', authContext.organizationId);
        const propIds = (orgProps ?? []).map((p: any) => p.id);

        const { data: tenantCheck } = await client
          .from('tenants')
          .select('units!inner(property_id)')
          .eq('id', tenantId)
          .in('unit_id', (await client.from('units').select('id').in('property_id', propIds)).data?.map((u: any) => u.id) || []);

        if (!tenantCheck || tenantCheck.length === 0) {
          return NextResponse.json({ message: 'You can only upload documents for your own tenants.' }, { status: 403 });
        }
      }

      const { data: tenant, error: tenantError } = await client
        .from('tenants')
        .select('id')
        .eq('id', tenantId)
        .single();

      if (tenantError || !tenant) {
        return NextResponse.json({ message: 'Invalid tenant ID.' }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const fileName = `${tenantId}/${documentType}/${generateId()}-${file.name}`;
      const filePath = `tenant-documents/${fileName}`;

      const { data: storageData, error: storageError } = await client.storage
        .from('documents')
        .upload(filePath, buffer, { contentType: file.type });

      if (storageError) throw storageError;

      const { data: publicUrl } = client.storage.from('documents').getPublicUrl(storageData.path);

      const isLandlordUpload = documentType === 'agreement';
      const status = isLandlordUpload ? 'sent' : 'signed';

      // For tenant uploads, create or update bundle
      if (!isLandlordUpload) {
        const bundleResult = await client
          .from('document_bundles')
          .select('id')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        let bundleId: string | undefined;
        if (!bundleResult.data) {
          const newBundle = await client
            .from('document_bundles')
            .insert({ tenant_id: tenantId })
            .select()
            .single();
          bundleId = newBundle.data?.id;
        } else {
          bundleId = bundleResult.data?.id;
        }

        // Update bundle with document URLs
        const bundleUpdate: any = {};
        if (documentType === 'signed_agreement') bundleUpdate.signed_agreement_url = publicUrl.publicUrl;
        if (documentType === 'id_document' && documentName === 'Passport Photo') bundleUpdate.passport_photo_url = publicUrl.publicUrl;
        if (documentType === 'id_document' && documentName !== 'Passport Photo') bundleUpdate.id_document_url = publicUrl.publicUrl;

        if (Object.keys(bundleUpdate).length > 0 && bundleId) {
          await client
            .from('document_bundles')
            .update(bundleUpdate)
            .eq('id', bundleId);
        }
      }

      const result = await client.from('documents')
        .insert({
          tenant_id: tenantId,
          uploaded_by: authContext.userId,
          document_name: documentName,
          document_url: publicUrl.publicUrl,
          document_type: documentType,
          status: status,
          notes: null,
        })
        .select()
        .single();

      if (result.error) throw result.error;

      if (documentName.toLowerCase().includes('photo')) {
        await client
          .from('tenants')
          .update({ passport_photo_url: publicUrl.publicUrl })
          .eq('id', tenantId);
      }

      return NextResponse.json({ message: 'Document uploaded.', document: result.data }, { status: 201 });
    } catch (error: any) {
      return NextResponse.json({ message: error.message ?? 'Unable to upload document.' }, { status: 500 });
    }
  }

  // Handle JSON body for landlord document assignment
  const body = await request.json();
  const {
    tenantId,
    documentName,
    documentUrl,
    documentType,
    notes
  } = body;

  if (!tenantId || !documentName || !documentUrl) {
    return NextResponse.json({ message: 'Missing required fields.' }, { status: 400 });
  }

  const validTypes = ['agreement', 'id_document', 'signed_agreement'];
  if (!validTypes.includes(documentType)) {
    return NextResponse.json({ message: 'Invalid document type.' }, { status: 400 });
  }

  // Verify tenant belongs to landlord's organization
  if (!authContext.isSuperAdmin && authContext.organizationId) {
    const { data: orgProps } = await client
      .from('properties')
      .select('id')
      .eq('organization_id', authContext.organizationId);
    const propIds = (orgProps ?? []).map((p: any) => p.id);
    const { data: orgUnits } = await client.from('units').select('id').in('property_id', propIds);
    const unitIds = (orgUnits ?? []).map((u: any) => u.id);
    const { data: tenantCheck } = await client
      .from('tenants')
      .select('id')
      .eq('id', tenantId)
      .in('unit_id', unitIds)
      .maybeSingle();
    if (!tenantCheck) {
      return NextResponse.json({ message: 'You can only upload documents for your own tenants.' }, { status: 403 });
    }
  }

  const result = await client.from('documents').insert({
    tenant_id: tenantId,
    uploaded_by: authContext.userId,
    document_name: documentName,
    document_url: documentUrl,
    document_type: documentType,
    status: documentType === 'signed_agreement' ? 'signed' : 'sent',
    notes: notes || null,
  }).select();

  if (result.error) {
    return NextResponse.json({ message: result.error.message }, { status: 500 });
  }

  // If signed agreement, update tenant record
  if (documentType === 'signed_agreement') {
    await client
      .from('tenants')
      .update({ signed_agreement_url: documentUrl })
      .eq('id', tenantId);
  }

  return NextResponse.json({ message: 'Document uploaded.', document: result.data?.[0] }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const client = getSupabaseAdmin();
  const authContext = await getAuthContext(request);

  if (!authContext.userId) {
    return NextResponse.json({ message: 'Authentication required.' }, { status: 401 });
  }

  const body = await request.json();
  const { id, status, notes } = body;

  if (!id) {
    return NextResponse.json({ message: 'Document ID is required.' }, { status: 400 });
  }

  // Verify document belongs to user's organization
  if (!authContext.isSuperAdmin) {
    const userMetadata = authContext.userMetadata || {};
    const isAgent = userMetadata.role === 'agent';
    const agentPropertyId = isAgent ? userMetadata.property_id : null;
    let tenantIds: string[] = [];

    if (agentPropertyId) {
      const { data: units } = await client
        .from('units')
        .select('id')
        .eq('property_id', agentPropertyId);
      const unitIds = (units ?? []).map((u: any) => u.id);
      const { data: tenants } = await client
        .from('tenants')
        .select('id')
        .in('unit_id', unitIds);
      tenantIds = (tenants ?? []).map((t: any) => t.id);
    } else if (authContext.organizationId) {
      const { data: orgProps } = await client
        .from('properties')
        .select('id')
        .eq('organization_id', authContext.organizationId);
      const propIds = (orgProps ?? []).map((p: any) => p.id);
      const { data: orgUnits } = await client.from('units').select('id').in('property_id', propIds);
      const unitIds = (orgUnits ?? []).map((u: any) => u.id);
      const { data: tenants } = await client
        .from('tenants')
        .select('id')
        .in('unit_id', unitIds);
      tenantIds = (tenants ?? []).map((t: any) => t.id);
    }

    if (tenantIds.length > 0) {
      const { data: docCheck } = await client
        .from('documents')
        .select('id')
        .eq('id', id)
        .in('tenant_id', tenantIds)
        .maybeSingle();
      if (!docCheck) {
        return NextResponse.json({ message: 'You can only update documents for your own tenants.' }, { status: 403 });
      }
    }
  }

  const updateData: any = {
    status: status || 'sent',
    notes: notes || null,
    updated_at: new Date().toISOString(),
  };

  const result = await client.from('documents')
    .update(updateData)
    .eq('id', id)
    .select();

  if (result.error) {
    return NextResponse.json({ message: result.error.message }, { status: 500 });
  }

  return NextResponse.json({ message: 'Document updated.', document: result.data?.[0] });
}

export async function DELETE(request: NextRequest) {
  const client = getSupabaseAdmin();
  const authContext = await getAuthContext(request);

  if (!authContext.userId) {
    return NextResponse.json({ message: 'Authentication required.' }, { status: 401 });
  }

  const body = await request.json();
  const { id } = body;

  if (!id) {
    return NextResponse.json({ message: 'Document ID is required.' }, { status: 400 });
  }

  // Verify document belongs to user's organization
  if (!authContext.isSuperAdmin) {
    const userMetadata = authContext.userMetadata || {};
    const isAgent = userMetadata.role === 'agent';
    const agentPropertyId = isAgent ? userMetadata.property_id : null;
    let tenantIds: string[] = [];

    if (agentPropertyId) {
      const { data: units } = await client
        .from('units')
        .select('id')
        .eq('property_id', agentPropertyId);
      const unitIds = (units ?? []).map((u: any) => u.id);
      const { data: tenants } = await client
        .from('tenants')
        .select('id')
        .in('unit_id', unitIds);
      tenantIds = (tenants ?? []).map((t: any) => t.id);
    } else if (authContext.organizationId) {
      const { data: orgProps } = await client
        .from('properties')
        .select('id')
        .eq('organization_id', authContext.organizationId);
      const propIds = (orgProps ?? []).map((p: any) => p.id);
      const { data: orgUnits } = await client.from('units').select('id').in('property_id', propIds);
      const unitIds = (orgUnits ?? []).map((u: any) => u.id);
      const { data: tenants } = await client
        .from('tenants')
        .select('id')
        .in('unit_id', unitIds);
      tenantIds = (tenants ?? []).map((t: any) => t.id);
    }

    if (tenantIds.length > 0) {
      const { data: docCheck } = await client
        .from('documents')
        .select('id')
        .eq('id', id)
        .in('tenant_id', tenantIds)
        .maybeSingle();
      if (!docCheck) {
        return NextResponse.json({ message: 'You can only delete documents for your own tenants.' }, { status: 403 });
      }
    }
  }

  const result = await client.from('documents')
    .delete()
    .eq('id', id);

  if (result.error) {
    return NextResponse.json({ message: result.error.message }, { status: 500 });
  }

  return NextResponse.json({ message: 'Document deleted.' });
}