-- Site settings: super-admin editable public-page content and background images.
-- Single-row table (id = 1) so updates are simple upserts.

create table if not exists public.site_settings (
  id                          integer primary key default 1 check (id = 1),
  hero_eyebrow                text not null default 'Project management platform',
  hero_title                  text not null default 'Property management software for landlords, agents, and tenants.',
  hero_subtitle               text not null default 'Manage rental properties in Kenya, assign agents, onboard tenants, track rent payments, manage leases, and coordinate maintenance from one platform.',
  hero_cta_primary_label      text not null default 'Log In',
  hero_cta_primary_href       text not null default '/login',
  hero_cta_secondary_label    text not null default 'Tenant Registration',
  hero_cta_secondary_href     text not null default '/tenant/register',
  hero_bg_url                 text,
  login_bg_url                text,
  updated_at                  timestamp with time zone not null default now()
);

-- Ensure the single row exists with defaults.
insert into public.site_settings (id) values (1)
on conflict (id) do nothing;

alter table public.site_settings enable row level security;

-- Public can read the settings (landing page renders them server-side too).
drop policy if exists "site_settings_public_read" on public.site_settings;
create policy "site_settings_public_read"
  on public.site_settings for select
  using (true);

-- Only the service role (API routes gated to super_admin) writes. RLS blocks anon/authenticated writes.
drop policy if exists "site_settings_no_client_write" on public.site_settings;
create policy "site_settings_no_client_write"
  on public.site_settings for all
  using (false) with check (false);

-- Public storage bucket for uploaded background images.
insert into storage.buckets (id, name, public)
values ('site-media', 'site-media', true)
on conflict (id) do nothing;

-- Allow anonymous read of uploaded media so backgrounds load for everyone.
drop policy if exists "site_media_public_read" on storage.objects;
create policy "site_media_public_read"
  on storage.objects for select
  using (bucket_id = 'site-media');

-- Uploads/downloads are performed with the service role (bypasses RLS); no client write policy needed.
