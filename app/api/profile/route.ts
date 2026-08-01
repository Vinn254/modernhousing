import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { adminRequest } from '../../../lib/supabaseAdmin';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase client environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

function parseMetadata(value: unknown) {
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === 'object' && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

function buildProfileUpdate(profileData: Record<string, any>, action?: string) {
  const metadata: Record<string, any> = {
    ...profileData,
    bank_details_edit_allowed: profileData.bank_details_edit_allowed ?? true,
    bank_edit_request: Boolean(profileData.bank_edit_request),
  };

  if (action === 'request_bank_edit_unlock') {
    metadata.bank_edit_request = true;
    metadata.bank_details_edit_allowed = false;
  }

  return {
    full_name: metadata.full_name ?? metadata.fullName ?? null,
    email: metadata.email ?? null,
    phone: metadata.phone ?? null,
    organization_name: metadata.organization_name ?? metadata.organization ?? null,
    id_number: metadata.id_number ?? null,
    kra_pin: metadata.kra_pin ?? null,
    property_name: metadata.property_name ?? null,
    property_location: metadata.property_location ?? null,
    number_of_units: metadata.number_of_units ?? null,
    account_holder_name: metadata.account_holder_name ?? null,
    bank_name: metadata.bank_name ?? null,
    account_number: metadata.account_number ?? null,
    branch: metadata.branch ?? null,
    agreement_accepted: Boolean(metadata.agreement_accepted),
    signed_on: metadata.signed_on ?? null,
    bank_details_edit_allowed: metadata.bank_details_edit_allowed ?? true,
    bank_edit_request: Boolean(metadata.bank_edit_request),
    status: 'pending',
    picture_url: JSON.stringify(metadata),
    updated_at: new Date().toISOString(),
  };
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') ?? request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    const metadata = parseMetadata(profile?.picture_url);
    const mergedProfile = metadata && typeof metadata === 'object'
      ? { ...profile, ...metadata }
      : profile;

    return NextResponse.json({ profile: mergedProfile ?? null });
  } catch (error: any) {
    return NextResponse.json({ message: error.message ?? 'Unable to load profile.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, profileData, action } = body;

    if (!userId) {
      return NextResponse.json({ message: 'User ID is required.' }, { status: 400 });
    }

    const updates = profileData ?? body;
    const payload = buildProfileUpdate(updates, action);

    const { data: existingProfile, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json({ message: fetchError.message }, { status: 500 });
    }

    let profile;
    if (existingProfile) {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .update(payload)
        .eq('user_id', userId)
        .select('*')
        .single();
      profile = data;
      if (error) return NextResponse.json({ message: error.message }, { status: 500 });
    } else {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .insert({ user_id: userId, ...payload, role: 'project_manager', status: 'pending' })
        .select('*')
        .single();
      profile = data;
      if (error) return NextResponse.json({ message: error.message }, { status: 500 });
    }

    const metadata = parseMetadata(profile?.picture_url);
    const mergedProfile = metadata && typeof metadata === 'object'
      ? { ...profile, ...metadata }
      : profile;

    return NextResponse.json({ profile: mergedProfile });
  } catch (error: any) {
    return NextResponse.json({ message: error.message ?? 'Unable to update profile.' }, { status: 500 });
  }
}
