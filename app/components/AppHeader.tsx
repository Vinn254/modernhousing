'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

type Role = 'super_admin' | 'admin' | 'landlord' | 'agent' | 'tenant' | 'user';

export default function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<Role>('user');
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const resolveRole = (currentUser: any): Role => {
    if (currentUser?.email === 'vin.oumaotieno@gmail.com') return 'super_admin';
    const metadataRole = currentUser?.user_metadata?.role;
    if (metadataRole === 'admin') return 'landlord';
    if (metadataRole === 'super_admin') return 'super_admin';
    if (metadataRole === 'agent') return 'agent';
    if (metadataRole === 'tenant') return 'tenant';
    return 'user';
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        setUser(data.session.user);
        setRole(resolveRole(data.session.user));
      }
      setRoleLoaded(true);
    });

    supabase.auth.getUser().then(({ data, error }) => {
      if (!error && data.user) {
        setUser(data.user);
        setRole(resolveRole(data.user));
      }
      setRoleLoaded(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setRole(resolveRole(session?.user));
      setRoleLoaded(true);
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

  const getInitials = (name: string) => {
    return name?.split(' ').map((part) => part[0]).join('').toUpperCase() || 'U';
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setRoleLoaded(false);
    router.push('/');
  };

  const shouldHideHeader = pathname === '/' || pathname === '/login' || pathname === '/signup' || pathname?.startsWith('/super-admin') || pathname?.startsWith('/admin') || pathname?.startsWith('/tenant');

  if (shouldHideHeader || !roleLoaded) return null;

  const isTenant = role === 'tenant';
  const isAgent = role === 'agent';
  const isLandlord = role === 'landlord';
  const isSuperAdmin = role === 'super_admin';

  const dashboardHref = isTenant ? '/tenant/dashboard' : '/dashboard';
  const dashboardLabel = isTenant ? 'Tenant Dashboard' : isAgent ? 'Agent Dashboard' : 'Landlord Dashboard';

  return (
    <>
      {user && (
        <>
          <button className="menu-toggle" onClick={() => setSidebarOpen(true)} aria-label="Open menu">☰</button>

          <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
            <div className="sidebar-header">
              <h2 className="sidebar-logo">Springfield</h2>
            </div>
            <nav className="sidebar-nav">
              <Link href={dashboardHref}>{dashboardLabel}</Link>
              {!isTenant && <Link href="/properties">Properties</Link>}
              {!isTenant && <Link href="/tenants">Tenants</Link>}
              {!isTenant && <Link href="/payments">Payments</Link>}
              {isSuperAdmin && <Link href="/super-admin">Super Admin</Link>}
              <button onClick={handleLogout} className="sidebar-logout">Logout</button>
            </nav>
          </div>

          <div className={`overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)}></div>
        </>
      )}

      <header className="app-header">
        <div className="app-header-content">
          <Link href={isTenant ? '/tenant/dashboard' : '/'} className="app-logo" title="Springfield Systems">Springfield Systems</Link>
          {user && (
            <div className="header-menu" ref={menuRef}>
              <button className="header-menu-trigger" onClick={() => setMenuOpen(!menuOpen)} aria-label="Open account menu">
                <span className="user-avatar">{getInitials(user.user_metadata?.full_name || user.email)}</span>
              </button>
              {menuOpen && (
                <div className="menu-dropdown">
                  <div style={{ padding: '8px 12px', color: 'var(--ink-3)', fontSize: '12px', borderBottom: '1px solid var(--line-soft)' }}>{user.email}</div>
                  <Link href={dashboardHref}>{dashboardLabel}</Link>
                  {!isTenant && <Link href="/properties">Properties</Link>}
                  {!isTenant && <Link href="/tenants">Tenants</Link>}
                  {!isTenant && <Link href="/payments">Payments</Link>}
                  {isSuperAdmin && <Link href="/super-admin">Super Admin</Link>}
                  {isLandlord && <Link href="/dashboard">Agent Management</Link>}
                  <button onClick={handleLogout}>Logout</button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>
    </>
  );
}
