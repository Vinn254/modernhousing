import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase server environment variables');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function getAuthContext(request: NextRequest) {
  const headers: Record<string, string> = {
    cookie: request.headers.get('cookie') ?? '',
  };
  const authorization = request.headers.get('authorization') ?? request.headers.get('Authorization');
  if (authorization) headers.Authorization = authorization;

  const supabaseAuth = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '', {
    global: { headers },
  });

  const { data: sessionData, error: sessionError } = await supabaseAuth.auth.getSession();

  if (sessionError || !sessionData.session) {
    return { isSuperAdmin: false, organization_id: null, profile: null };
  }

const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, user_id, organization_id, role, full_name, email')
      .eq('user_id', sessionData.session.user.id)
      .single();

    let orgId = profile?.organization_id ?? sessionData.session.user?.user_metadata?.organization_id ?? null;
    // Allow reassignment
    let profileData = profile;

    if (!orgId && profile?.role === 'project_manager') {
      const { data: newOrg } = await supabaseAdmin
        .from('organizations')
        .insert({ name: `${sessionData.session.user.email?.split('@')[0] ?? 'Property Manager'} Organization` })
        .select('id')
        .single();
      orgId = newOrg?.id ?? null;
      if (orgId && profileData) {
        await supabaseAdmin.from('profiles').update({ organization_id: orgId }).eq('id', profileData.id);
        profileData = { ...profileData, organization_id: orgId };
      }
    }

    return {
      isSuperAdmin: profile?.role === 'super_admin',
      organization_id: orgId,
      profile: profileData,
    };
  }

export async function GET(request: NextRequest) {
   try {
     const authContext = await getAuthContext(request);

     if (!authContext.isSuperAdmin) {
       if (!authContext.organization_id) {
         return NextResponse.json({ payments: [] });
       }

       const { data: orgProps } = await supabaseAdmin
         .from('properties')
         .select('id')
         .eq('organization_id', authContext.organization_id);
       const propIds = (orgProps ?? []).map((p: any) => p.id);

       if (propIds.length > 0) {
         const { data: orgTenants } = await supabaseAdmin
           .from('tenants')
           .select('id')
           .in('unit_id', (await supabaseAdmin.from('units').select('id').in('property_id', propIds)).data?.map(u => u.id) ?? []);
         const tenantIds = (orgTenants ?? []).map((t: any) => t.id);

         const { data, error } = await supabaseAdmin
           .from('payments')
           .select('*, tenants(full_name, email, units(property_id))')
           .in('tenant_id', tenantIds)
           .order('created_at', { ascending: false });

         if (error) throw error;
         const payments = (data ?? []).map((payment: any) => ({
           ...payment,
           tenant: payment.tenants?.full_name ?? payment.tenant ?? '',
           tenant_email: payment.tenants?.email ?? '',
           property: '',
           unit: '',
         }));
         return NextResponse.json({ payments });
       }
       return NextResponse.json({ payments: [] });
     }

     let query: any = supabaseAdmin.from('payments').select('*, tenants(full_name, email, units(property_id, properties(name)))');

     const { data, error } = await query.order('created_at', { ascending: false });

     if (error) throw error;

     const payments = (data ?? []).map((payment: any) => ({
       ...payment,
       tenant: payment.tenants?.full_name ?? payment.tenant ?? '',
       tenant_email: payment.tenants?.email ?? '',
       property: payment.tenants?.units?.properties?.name ?? '',
       unit: '',
     }));

     return NextResponse.json({ payments });
   } catch (error: any) {
     return NextResponse.json({ payments: [], message: error.message ?? 'Unable to load payments.' }, { status: 500 });
   }
 }

export async function POST(request: NextRequest) {
    const body = await request.json();
    const { tenantId, description, transactionType, amount, balanceRemaining, propertyId } = body;

    if (!tenantId || !description || !transactionType || amount == null || balanceRemaining == null) {
      return NextResponse.json({ message: 'Missing required payment fields.' }, { status: 400 });
    }

    const result = await supabaseAdmin.from('payments').insert({
      tenant_id: tenantId,
      property_id: propertyId ?? null,
      description,
      transaction_type: transactionType,
      amount,
      balance_remaining: balanceRemaining,
      paid_at: new Date().toISOString(),
    });

    if (result.error) {
      return NextResponse.json({ message: result.error.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Payment recorded.' }, { status: 201 });
  }