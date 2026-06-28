import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase server environment variables');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

export async function GET(request: NextRequest) {
  try {
    const headers: Record<string, string> = {
      cookie: request.headers.get('cookie') ?? '',
      Authorization: request.headers.get('authorization') ?? '',
    };

    const supabaseAuth = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '', {
      global: { headers },
    });

    const { data: { session } } = await supabaseAuth.auth.getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ documents: [], message: 'Not authorized.' }, { status: 401 });
    }

    // Get or create profile with organization
    let { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, user_id, organization_id, role')
      .eq('user_id', session.user.id)
      .single();

    if (!profile?.organization_id && session.user.user_metadata?.role !== 'super_admin') {
      // Create organization for project_manager users without org
      const { data: newOrg } = await supabaseAdmin
        .from('organizations')
        .insert({ name: `${session.user.email?.split('@')[0] ?? 'Property Manager'} Organization` })
        .select('id')
        .single();

      if (profile) {
        await supabaseAdmin
          .from('profiles')
          .update({ organization_id: newOrg?.id ?? null })
          .eq('id', profile.id);
        profile = { ...profile, organization_id: newOrg?.id ?? null };
      } else {
        const createdProfile = await supabaseAdmin
          .from('profiles')
          .insert({
            user_id: session.user.id,
            full_name: session.user.user_metadata?.full_name ?? session.user.email,
            email: session.user.email,
            role: 'project_manager',
            organization_id: newOrg?.id ?? null,
            status: 'active',
          })
          .select('id, user_id, organization_id, role')
          .single();
        profile = createdProfile.data;
      }
    }

    if (!profile?.organization_id) {
      return NextResponse.json({ documents: [] });
    }

    // Get all properties for this organization
    const { data: orgProps } = await supabaseAdmin
      .from('properties')
      .select('id')
      .eq('organization_id', profile.organization_id);
    const propIds = new Set((orgProps ?? []).map((p: any) => p.id));

    // Get documents with tenant info
    const { data, error } = await supabaseAdmin
      .from('tenant_documents')
      .select(`
        id,
        tenant_id,
        document_type,
        file_path,
        file_name,
        created_at,
        tenants(full_name),
        units!inner(property_id)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ documents: [], message: error.message }, { status: 500 });
    }

    const documents = (data ?? [])
      .filter((d: any) => d.tenant_id && d.units && propIds.has(d.units.property_id))
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