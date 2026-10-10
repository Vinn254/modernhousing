import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { DEFAULT_SITE_SETTINGS, getSiteSettings, type SiteSettings } from '../../../lib/siteSettings';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

function getAdminClient() {
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing Supabase server environment variables');
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
}

async function requireSuperAdmin(request: NextRequest) {
  const header = request.headers.get('authorization') ?? '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token) return { ok: false as const, status: 401, message: 'Authentication required.' };

  const supabase = getAdminClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return { ok: false as const, status: 401, message: 'Invalid or expired session.' };

  const role = data.user.user_metadata?.role;
  if (role !== 'super_admin') return { ok: false as const, status: 403, message: 'Only a super admin can update site settings.' };
  return { ok: true as const, user: data.user };
}

export async function GET() {
  try {
    const settings = await getSiteSettings();
    return NextResponse.json({ settings });
  } catch (error: any) {
    return NextResponse.json({ message: error.message ?? 'Unable to load settings.', settings: DEFAULT_SITE_SETTINGS }, { status: 500 });
  }
}

const STRING_KEYS: (keyof SiteSettings)[] = [
  'hero_eyebrow', 'hero_title', 'hero_subtitle',
  'hero_cta_primary_label', 'hero_cta_primary_href',
  'hero_cta_secondary_label', 'hero_cta_secondary_href',
  'hero_bg_url', 'login_bg_url',
];

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status });

    const body = await request.json().catch(() => ({}));
    const supabase = getAdminClient();

    const payload: Record<string, string | null> = {};
    for (const key of STRING_KEYS) {
      if (!(key in body)) continue;
      const value = body[key];
      payload[key] = value === null || value === '' ? null : String(value);
    }

    const { error } = await supabase
      .from('site_settings')
      .upsert({ id: 1, ...payload, updated_at: new Date().toISOString() }, { onConflict: 'id' });

    if (error) throw error;

    const settings = await getSiteSettings();
    return NextResponse.json({ message: 'Site settings saved.', settings });
  } catch (error: any) {
    return NextResponse.json({ message: error.message ?? 'Unable to save site settings.' }, { status: 500 });
  }
}
