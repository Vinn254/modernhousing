'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
const landlordPMLinks = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Properties', href: '/properties' },
    { label: 'Units', href: '/admin/units' },
    { label: 'Tenants', href: '/admin/tenants' },
    { label: 'Agents', href: '/admin/agents' },
    { label: 'Payments', href: '/admin/payments' },
    { label: 'Utilities', href: '/admin/utilities' },
    { label: 'Communications', href: '/admin/communications' },
];
const superAdminLinks = [
    { label: 'Dashboard', href: '/super-admin' },
    { label: 'Landlords', href: '/super-admin/landlords' },
    { label: 'Agents', href: '/super-admin/agents' },
];
export default function AdminTopNav({ variant = 'super' }) {
    const router = useRouter();
    const menuRef = useRef(null);
    const [user, setUser] = useState(null);
    const [menuOpen, setMenuOpen] = useState(false);
    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            if (data.session?.user)
                setUser(data.session.user);
        });
        supabase.auth.getUser().then(({ data, error }) => {
            if (!error && data.user)
                setUser(data.user);
        });
        const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            setMenuOpen(false);
        });
        return () => listener?.subscription.unsubscribe();
    }, []);
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    const role = user?.user_metadata?.role === 'super_admin' ? 'super_admin' : user?.user_metadata?.role || 'user';
    const fullName = user?.user_metadata?.full_name || user?.email || 'User';
    const initials = fullName
        .split(' ')
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
    const links = variant === 'admin' ? landlordPMLinks : superAdminLinks;
    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/');
    };
    if (!user) {
        return (<div className="nav-links admin-nav-links" style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#fff' }}>
        <Link href="/login" className="admin-nav-link admin-nav-login-fallback" style={{ display: 'inline-flex', alignItems: 'center', padding: '8px 12px', borderRadius: '999px', color: '#052e1f', textDecoration: 'none', fontSize: '13px', fontWeight: 900, background: 'linear-gradient(135deg, #10b981, #34d399)' }}>
          Login
        </Link>
      </div>);
    }
    return (<div className="nav-links admin-nav-links" ref={menuRef} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff' }}>
      {links.map((link) => (<Link key={link.href} href={link.href} className="landlord-nav-link" style={{ display: 'inline-flex', alignItems: 'center', padding: '8px 14px', borderRadius: '999px', color: '#e2e8f0', textDecoration: 'none', fontSize: '13px', fontWeight: 600, background: 'rgba(255,255,255,0.08)', transition: 'all .2s' }}>
          {link.label}
        </Link>))}

      <div className="nav-menu" style={{ position: 'relative', marginLeft: '6px' }}>
        <button type="button" onClick={() => setMenuOpen(!menuOpen)} className="header-menu-trigger" aria-label="Open account menu" style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(16,185,129,0.12)', border: '1px solid var(--line)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="user-avatar" style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent)', color: '#fff', fontSize: '12px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{initials}</span>
        </button>

        {menuOpen && (<div className="menu-dropdown" style={{ position: 'absolute', top: 50, right: 0, minWidth: 210, padding: 10, borderRadius: 14, background: 'linear-gradient(135deg, #0a1f3a, #061528)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 16px 40px rgba(6,21,40,0.22)', zIndex: 100 }}>
            <div style={{ padding: '8px 10px 6px', color: '#fff', fontSize: '13px', fontWeight: 700 }}>{fullName}</div>
            <div style={{ padding: '0 10px 8px', color: 'var(--accent-bright)', fontSize: '12px', textTransform: 'capitalize' }}>{role.replace('_', ' ')}</div>
            {links.map((link) => (<Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)} style={{ display: 'block', padding: '10px 12px', color: '#8aa3c4', textDecoration: 'none', fontSize: '14px', fontWeight: 600, borderRadius: 8 }}>
                {link.label}
              </Link>))}
            <button type="button" onClick={handleLogout} style={{ display: 'block', width: '100%', padding: '10px 12px', color: '#fecaca', background: 'rgba(220,38,38,0.16)', border: 'none', borderRadius: 8, textAlign: 'left', cursor: 'pointer', fontSize: '14px', fontWeight: 600, marginTop: 6 }}>Logout</button>
          </div>)}
      </div>
    </div>);
}
