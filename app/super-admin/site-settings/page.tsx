'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import Card from '../../components/Card';

interface Settings {
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

const EMPTY: Settings = {
  hero_eyebrow: '',
  hero_title: '',
  hero_subtitle: '',
  hero_cta_primary_label: '',
  hero_cta_primary_href: '',
  hero_cta_secondary_label: '',
  hero_cta_secondary_href: '',
  hero_bg_url: null,
  login_bg_url: null,
};

export default function SiteSettingsPage() {
  const [form, setForm] = useState<Settings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<'hero' | 'login' | null>(null);
  const [status, setStatus] = useState<{ kind: 'ok' | 'err' | 'info'; text: string } | null>(null);
  const heroInputRef = useRef<HTMLInputElement>(null);
  const loginInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/site-settings');
        const data = await res.json();
        setForm({ ...EMPTY, ...(data.settings ?? {}) });
      } catch {
        setStatus({ kind: 'err', text: 'Could not load current settings. You can still save new values.' });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function getToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }

  async function handleUpload(slot: 'hero' | 'login', file: File) {
    const token = await getToken();
    if (!token) { setStatus({ kind: 'err', text: 'Session expired. Please sign in again.' }); return; }
    setUploading(slot);
    setStatus({ kind: 'info', text: 'Uploading image…' });
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('slot', slot);
      const res = await fetch('/api/site-settings/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Upload failed.');
      update(slot === 'login' ? 'login_bg_url' : 'hero_bg_url', data.url);
      setStatus({ kind: 'ok', text: 'Image uploaded. Click Save to publish it.' });
    } catch (err: any) {
      setStatus({ kind: 'err', text: err.message ?? 'Upload failed.' });
    } finally {
      setUploading(null);
    }
  }

  async function handleSave() {
    const token = await getToken();
    if (!token) { setStatus({ kind: 'err', text: 'Session expired. Please sign in again.' }); return; }
    setSaving(true);
    setStatus({ kind: 'info', text: 'Saving…' });
    try {
      const res = await fetch('/api/site-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Save failed.');
      setForm({ ...EMPTY, ...(data.settings ?? form) });
      setStatus({ kind: 'ok', text: 'Site settings saved and published.' });
    } catch (err: any) {
      setStatus({ kind: 'err', text: err.message ?? 'Save failed.' });
    } finally {
      setSaving(false);
    }
  }

  function clearImage(slot: 'hero' | 'login') {
    update(slot === 'login' ? 'login_bg_url' : 'hero_bg_url', null);
  }

  const statusStyle: React.CSSProperties = {
    padding: '10px 14px',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 18,
    background: status?.kind === 'ok' ? 'rgba(16,185,129,0.12)' : status?.kind === 'err' ? 'rgba(220,38,38,0.12)' : 'rgba(14,165,233,0.12)',
    color: status?.kind === 'ok' ? '#047857' : status?.kind === 'err' ? '#b91c1c' : '#0369a1',
    border: '1px solid rgba(148,163,184,0.25)',
  };

  return (
    <main className="container admin-no-hero">
      <div className="card-admin-header">
        <div>
          <p className="heading">Site Settings</p>
          <p className="subheading">Control the landing-page hero content and background images shown across the public site and login screen.</p>
        </div>
      </div>

      {status && <div style={statusStyle}>{status.text}</div>}
      {loading && <p style={{ color: 'var(--ink-3)' }}>Loading current settings…</p>}

      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18 }}>
          <Card
            tone="accent"
            title="Hero Text"
            subtitle="Eyebrow, headline, subheadline and call-to-action buttons"
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7V5h16v2"/><path d="M9 5v14"/><path d="M15 5v14"/></svg>}
          >
            <div style={{ display: 'grid', gap: 12 }}>
              <Field label="Eyebrow badge">
                <input className="ss-input" value={form.hero_eyebrow} onChange={(e) => update('hero_eyebrow', e.target.value)} />
              </Field>
              <Field label="Headline">
                <input className="ss-input" value={form.hero_title} onChange={(e) => update('hero_title', e.target.value)} />
              </Field>
              <Field label="Subheadline">
                <textarea className="ss-input" rows={3} value={form.hero_subtitle} onChange={(e) => update('hero_subtitle', e.target.value)} />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="Primary button label"><input className="ss-input" value={form.hero_cta_primary_label} onChange={(e) => update('hero_cta_primary_label', e.target.value)} /></Field>
                <Field label="Primary button link"><input className="ss-input" value={form.hero_cta_primary_href} onChange={(e) => update('hero_cta_primary_href', e.target.value)} /></Field>
                <Field label="Secondary button label"><input className="ss-input" value={form.hero_cta_secondary_label} onChange={(e) => update('hero_cta_secondary_label', e.target.value)} /></Field>
                <Field label="Secondary button link"><input className="ss-input" value={form.hero_cta_secondary_href} onChange={(e) => update('hero_cta_secondary_href', e.target.value)} /></Field>
              </div>
            </div>
          </Card>

          <Card
            tone="info"
            title="Background Images"
            subtitle="Animated zoom-out hero and login backgrounds"
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>}
          >
            <ImageSlot
              label="Landing hero background"
              url={form.hero_bg_url}
              busy={uploading === 'hero'}
              inputRef={heroInputRef}
              onPick={(file) => handleUpload('hero', file)}
              onClear={() => clearImage('hero')}
            />
            <ImageSlot
              label="Login page background"
              url={form.login_bg_url}
              busy={uploading === 'login'}
              inputRef={loginInputRef}
              onPick={(file) => handleUpload('login', file)}
              onClear={() => clearImage('login')}
            />
            <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: '4px 0 0' }}>
              Leave empty to use the built-in default image. PNG, JPG, WEBP or AVIF up to 8 MB.
            </p>
          </Card>
        </div>
      )}

      {!loading && (
        <div style={{ display: 'flex', gap: 12, marginTop: 22, alignItems: 'center' }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save & Publish'}
          </button>
          <a href="/" target="_blank" rel="noreferrer" className="btn btn-ghost">View landing page</a>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .ss-input { width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); color: var(--ink-2); font-size: 14px; font-family: inherit; }
        .ss-input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
        .ss-field-label { display: block; font-size: 12px; font-weight: 700; color: var(--ink-3); margin-bottom: 6px; letter-spacing: 0.02em; }
        .ss-slot { border: 1px solid var(--line); border-radius: 14px; padding: 12px; background: rgba(148,163,184,0.06); }
        .ss-slot-preview { width: 100%; height: 120px; border-radius: 10px; background-size: cover; background-position: center; margin-bottom: 10px; display: flex; align-items: flex-end; }
        .ss-slot-empty { background: repeating-linear-gradient(45deg, rgba(148,163,184,0.12), rgba(148,163,184,0.12) 10px, transparent 10px, transparent 20px); }
        .ss-mini { font-size: 12px; font-weight: 700; border: 1px solid var(--line); background: var(--surface); color: var(--ink-2); border-radius: 8px; padding: 6px 10px; cursor: pointer; }
        .ss-mini:hover { border-color: var(--accent); color: var(--accent); }
      ` }} />
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span className="ss-field-label">{label}</span>
      {children}
    </label>
  );
}

function ImageSlot({
  label, url, busy, inputRef, onPick, onClear,
}: {
  label: string;
  url: string | null;
  busy: boolean;
  inputRef: React.RefObject<HTMLInputElement>;
  onPick: (file: File) => void;
  onClear: () => void;
}) {
  return (
    <div className="ss-slot">
      <span className="ss-field-label">{label}</span>
      <div
        className={`ss-slot-preview${url ? '' : ' ss-slot-empty'}`}
        style={url ? { backgroundImage: `url('${url}')` } : undefined}
      >
        {url && <span style={{ background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 11, padding: '3px 8px', borderRadius: 8, margin: 8 }}>Custom image</span>}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/avif"
          style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ''; }}
        />
        <button type="button" className="ss-mini" onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? 'Uploading…' : 'Upload image'}
        </button>
        {url && <button type="button" className="ss-mini" onClick={onClear}>Use default</button>}
      </div>
    </div>
  );
}
