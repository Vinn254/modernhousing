'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

type Role = 'super_admin' | 'admin' | 'landlord' | 'agent' | 'tenant' | 'user';

export default function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<Role>('user');
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const resolveRole = (currentUser: any): Role => {
    if (currentUser?.email === 'vin.oumaotieno@gmail.com') return 'super_admin';
    const metadataRole = currentUser?.user_metadata?.role;
    if (metadataRole === 'admin') return 'landlord';
    if (metadataRole === 'super_admin') return 'super_admin';
    if (metadataRole === 'agent') return 'agent';
    if (metadataRole === 'tenant') return 'tenant';
    return 'user';
  };

  const getInitials = (name: string) => {
    return name?.split(' ').map((part) => part[0]).join('').toUpperCase() || 'U';
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setRoleLoaded(false);
    router.push('/');
  };

  const shouldHideHeader = pathname === '/' || pathname === '/login' || pathname === '/signup';

  if (shouldHideHeader || !roleLoaded) return null;

  const isTenant = role === 'tenant';
  const isAgent = role === 'agent';
  const isLandlord = role === 'landlord';
  const isSuperAdmin = role === 'super_admin';
  const isAdmin = role === 'admin';

  const dashboardHref = isTenant ? '/tenant/dashboard' : '/dashboard';
  const dashboardLabel = isTenant ? 'Tenant Dashboard' : isAgent ? 'Agent Dashboard' : 'Landlord Dashboard';

  const agentLinks: {label: string; href: string}[] = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Tenants', href: '/agent/tenants' },
    { label: 'Utilities', href: '/agent/utilities' },
    { label: 'Notifications', href: '/agent/notifications' },
    { label: 'Complaints', href: '/agent/complaints' },
  ];

  const tenantLinks: {label: string; href: string}[] = [
    { label: 'Dashboard', href: '/tenant/dashboard' },
    { label: 'Payments', href: '/tenant/payments' },
    { label: 'Documents', href: '/tenant/documents' },
    { label: 'Complaints', href: '/tenant/complaints' },
    { label: 'Notifications', href: '/tenant/notifications' },
  ];

  const landlordPMLinks: {label: string; href: string}[] = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Properties', href: '/properties' },
    { label: 'Units', href: '/admin/units' },
    { label: 'Tenants', href: '/admin/tenants' },
    { label: 'Agents', href: '/admin/agents' },
    { label: 'Payments', href: '/admin/payments' },
    { label: 'Utilities', href: '/admin/utilities' },
    { label: 'Communications', href: '/admin/communications' },
  ];

  const adminLinks: {label: string; href: string}[] = [
    { label: 'Dashboard', href: '/admin' },
    { label: 'Landlords', href: '/admin/project-managers' },
    { label: 'Agents', href: '/admin/agents' },
    { label: 'Tenants', href: '/admin/tenants' },
    { label: 'Payments', href: '/admin/payments' },
    { label: 'Communications', href: '/admin/communications' },
  ];

  const superAdminLinks: {label: string; href: string}[] = [
    { label: 'Dashboard', href: '/super-admin' },
    { label: 'Landlords', href: '/super-admin/landlords' },
    { label: 'Agents', href: '/super-admin/agents' },
    { label: 'Tenants', href: '/super-admin/tenants' },
    { label: 'Payments', href: '/super-admin/payments' },
    { label: 'Analytics', href: '/super-admin/analytics' },
  ];

  const navLinks = isTenant ? tenantLinks : (isAgent ? agentLinks : (isSuperAdmin ? superAdminLinks : (isAdmin ? adminLinks : landlordPMLinks)));

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
              {navLinks.map((link) => (
                <Link key={link.href} href={link.href} onClick={() => setSidebarOpen(false)}>{link.label}</Link>
              ))}
            </nav>
            <button onClick={handleLogout} className="sidebar-logout">Logout</button>
          </div>

          <div className={`overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)}></div>
        </>
      )}

      <header className="app-header">
        <div className="app-header-content">
          <Link href={isTenant ? '/tenant/dashboard' : '/'} className="app-logo" title="Springfield Systems">Springfield Systems</Link>
          {user && (
            <div className="header-profile">
              <span className="user-avatar">{getInitials(user.user_metadata?.full_name || user.email)}</span>
              <span className="user-name">{user.user_metadata?.full_name || user.email}</span>
            </div>
          )}
        </div>
      </header>
    </>
  );
}
