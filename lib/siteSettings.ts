import { createClient } from '@supabase/supabase-js';

export interface SiteSettings {
  hero_eyebrow: string;
  hero_title: string;
  hero_subtitle: string;
  hero_cta_primary_label: string;
  hero_cta_primary_href: string;
  hero_cta_secondary_label: string;
  hero_cta_secondary_href: string;
  hero_bg_url: string | null;
  login_bg_url: string | null;
}

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  hero_eyebrow: 'Project management platform',
  hero_title: 'Property management software for landlords, agents, and tenants.',
  hero_subtitle:
    'Manage rental properties in Kenya, assign agents, onboard tenants, track rent payments, manage leases, and coordinate maintenance from one platform.',
  hero_cta_primary_label: 'Log In',
  hero_cta_primary_href: '/login',
  hero_cta_secondary_label: 'Tenant Registration',
  hero_cta_secondary_href: '/tenant/register',
  hero_bg_url: null,
  login_bg_url: null,
};

function getServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function coerce(row: Record<string, any> | null | undefined): SiteSettings {
  if (!row) return { ...DEFAULT_SITE_SETTINGS };
  const merged = { ...DEFAULT_SITE_SETTINGS };
  (Object.keys(DEFAULT_SITE_SETTINGS) as (keyof SiteSettings)[]).forEach((key) => {
    const value = row[key];
    if (value === null || value === undefined) return;
    if (typeof merged[key] === 'string' && typeof value === 'string') {
      (merged[key] as string) = value;
    } else if (typeof value === 'string') {
      (merged[key] as any) = value;
    }
  });
  return merged;
}

export async function getSiteSettings(): Promise<SiteSettings> {
  const supabase = getServerClient();
  if (!supabase) return { ...DEFAULT_SITE_SETTINGS };
  try {
    const { data, error } = await supabase.from('site_settings').select('*').eq('id', 1).maybeSingle();
    if (error) return { ...DEFAULT_SITE_SETTINGS };
    return coerce(data);
  } catch {
    return { ...DEFAULT_SITE_SETTINGS };
  }
}
