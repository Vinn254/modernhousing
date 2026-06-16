'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

type Role = 'super_admin' | 'admin' | 'landlord' | 'agent' | 'tenant' | 'user';

type NavLink = {
  label: string;
  href: string;
};

const superAdminLinks: NavLink[] = [
  { label: 'Dashboard', href: '/super-admin' },
  { label: 'Landlords', href: '/super-admin/landlords' },
  { label: 'Agents', href: '/super-admin/agents' },
  { label: 'Properties', href: '/super-admin/properties' },
  { label: 'Payments', href: '/super-admin/payments' },
];

const adminLinks: NavLink[] = [
  { label: 'Dashboard', href: '/admin' },
  { label: 'Landlords', href: '/admin/project-managers' },
  { label: 'Agents', href: '/admin/agents' },
  { label: 'Properties', href: '/properties' },
  { label: 'Tenants', href: '/admin/tenants' },
  { label: 'Payments', href: '/admin/payments' },
  { label: 'Announcements', href: '/admin/communications' },
];

export default function AdminTopNav({ variant = 'super' }: { variant?: 'super' | 'admin' }) {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const [user, setUser] = useState<any>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) setUser(data.session.user);
    });

    supabase.auth.getUser().then(({ data, error }) => {
      if (!error && data.user) setUser(data.user);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setMenuOpen(false);
    });

    return () => listener?.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const role: Role = user?.user_metadata?.role === 'super_admin' ? 'super_admin' : user?.user_metadata?.role || 'user';
  const fullName = user?.user_metadata?.full_name || user?.email || 'User';
  const initials = fullName
    .split(' ')
    .map((part: string) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const links = variant === 'admin' ? adminLinks : superAdminLinks;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  if (!user) {
    return (
      <div className="nav-links admin-nav-links" style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#fff' }}>
        <Link href="/login" className="admin-nav-link admin-nav-login-fallback" style={{ display: 'inline-flex', alignItems: 'center', padding: '8px 12px', borderRadius: '999px', color: '#052e1f', textDecoration: 'none', fontSize: '13px', fontWeight: 900, background: 'linear-gradient(135deg, #10b981, #34d399)' }}>
          Login
        </Link>
      </div>
    );
  }

  return (
    <div className="nav-links admin-nav-links" ref={menuRef} style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#fff' }}>
      {links.map((link) => (
        <Link key={link.href} href={link.href} className="admin-nav-link" style={{ display: 'inline-flex', alignItems: 'center', padding: '8px 12px', borderRadius: '999px', color: '#e2e8f0', textDecoration: 'none', fontSize: '13px', fontWeight: 800, background: 'rgba(255,255,255,0.08)' }}>
          {link.label}
        </Link>
      ))}

      <div className="nav-menu" style={{ position: 'relative' }}>
        <button type="button" onClick={() => setMenuOpen(!menuOpen)} className="nav-menu-trigger" aria-label="Open account menu" style={{ width: 42, height: 42, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.1)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="user-avatar nav-user-avatar">{initials}</span>
        </button>

        {menuOpen && (
          <div className="nav-menu-dropdown" style={{ position: 'absolute', top: 54, right: 0, minWidth: 230, padding: 10, borderRadius: 16, background: 'linear-gradient(135deg, #0a1f3a, #061528)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 18px 45px rgba(6,21,40,0.28)', zIndex: 120 }}>
            <div className="nav-menu-user">{fullName}</div>
            <div className="nav-menu-role">{role.replace('_', ' ')}</div>
            {links.map((link) => (
              <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)}>
                {link.label}
              </Link>
            ))}
            <button type="button" className="nav-menu-logout" onClick={handleLogout}>Logout</button>
          </div>
        )}
      </div>
    </div>
  );
}
