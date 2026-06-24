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
      Authorization: request.headers.get('authorization') ?? '',
    };

    const supabaseAuth = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '', {
      global: { headers },
    });

    const { data: { session } } = await supabaseAuth.auth.getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ documents: [], message: 'Not authorized.' }, { status: 401 });
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('user_id, organization_id')
      .eq('user_id', session.user.id)
      .single();

    const { data, error } = await supabaseAdmin
      .from('tenant_documents')
      .select(`
        id,
        tenant_id,
        document_type,
        file_path,
        file_name,
        created_at,
        tenants(full_name)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ documents: [], message: error.message }, { status: 500 });
    }

    const documents = (data ?? [])
      .filter((d: any) => d.tenant_id)
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