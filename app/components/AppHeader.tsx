'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

type Role = 'super_admin' | 'admin' | 'landlord' | 'agent' | 'tenant' | 'user';

type IconName =
  | 'dashboard'
  | 'properties'
  | 'agents'
  | 'tenants'
  | 'payments'
  | 'utilities'
  | 'communications'
  | 'documents'
  | 'terms'
  | 'landlords'
  | 'analytics'
  | 'complaints'
  | 'notifications'
  | 'help';

type NavLink = { label: string; href: string; icon: IconName };

function NavIcon({ name }: { name: IconName }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (name) {
    case 'dashboard':
      return <svg {...common}><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></svg>;
    case 'properties':
      return <svg {...common}><path d="M3 21h18" /><path d="M5 21V7l8-4v18" /><path d="M19 21V11l-6-4" /></svg>;
    case 'agents':
      return <svg {...common}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
    case 'tenants':
      return <svg {...common}><path d="M3 9.5 12 3l9 6.5" /><path d="M5 10v10h14V10" /><path d="M9 20v-6h6v6" /></svg>;
    case 'payments':
      return <svg {...common}><rect x="1.5" y="5" width="21" height="14" rx="2.5" /><path d="M1.5 10h21" /><path d="M5 15h4" /></svg>;
    case 'utilities':
      return <svg {...common}><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></svg>;
    case 'communications':
      return <svg {...common}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>;
    case 'documents':
      return <svg {...common}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>;
    case 'terms':
      return <svg {...common}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><line x1="9" y1="13" x2="15" y2="13" /><line x1="9" y1="17" x2="15" y2="17" /></svg>;
    case 'landlords':
      return <svg {...common}><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>;
    case 'analytics':
      return <svg {...common}><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>;
    case 'complaints':
      return <svg {...common}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>;
    case 'notifications':
      return <svg {...common}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>;
    case 'help':
      return <svg {...common}><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 6" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>;
    default:
      return null;
  }
}

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
    if (metadataRole === 'project_manager') return 'landlord';
    if (metadataRole === 'admin') return 'landlord';
    if (metadataRole === 'super_admin') return 'super_admin';
    if (metadataRole === 'agent') return 'agent';
    if (metadataRole === 'tenant') return 'tenant';
    return 'user';
  };

  const getInitials = (name: string) => {
    return name?.split(' ').map((part) => part[0]).join('').toUpperCase() || 'U';
  };

  const checkSession = () => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        setUser(data.session.user);
        setRole(resolveRole(data.session.user));
      }
      setRoleLoaded(true);
    });
  };

  useEffect(() => {
    checkSession();

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
    router.replace('/');
  };

  const shouldHideHeader = pathname === '/' || pathname === '/login' || pathname === '/signup' || pathname === '/forgot-password' || pathname === '/reset-password' || pathname.startsWith('/tenant/register');

  if (shouldHideHeader || !user || !roleLoaded) return null;

  const isTenant = role === 'tenant';
  const isAgent = role === 'agent';
  const isLandlord = role === 'landlord';
  const isSuperAdmin = role === 'super_admin';
  const isAdmin = role === 'admin';

  const agentLinks: NavLink[] = [
    { label: 'Dashboard', href: '/dashboard', icon: 'dashboard' },
    { label: 'Tenants', href: '/agent/tenants', icon: 'tenants' },
    { label: 'Utilities', href: '/agent/utilities', icon: 'utilities' },
    { label: 'Notifications', href: '/agent/notifications', icon: 'notifications' },
    { label: 'Complaints', href: '/agent/complaints', icon: 'complaints' },
    { label: 'Help', href: '/help', icon: 'help' },
  ];

  const tenantLinks: NavLink[] = [
    { label: 'Dashboard', href: '/tenant/dashboard', icon: 'dashboard' },
    { label: 'Payments', href: '/tenant/payments', icon: 'payments' },
    { label: 'Documents', href: '/tenant/documents', icon: 'documents' },
    { label: 'Complaints', href: '/tenant/complaints', icon: 'complaints' },
    { label: 'Notifications', href: '/tenant/notifications', icon: 'notifications' },
    { label: 'Help', href: '/help', icon: 'help' },
  ];

  const landlordPMLinks: NavLink[] = [
    { label: 'Dashboard', href: '/admin', icon: 'dashboard' },
    { label: 'Properties', href: '/properties', icon: 'properties' },
    { label: 'Agents', href: '/admin/agents', icon: 'agents' },
    { label: 'Tenants', href: '/admin/tenants', icon: 'tenants' },
    { label: 'Payments', href: '/payments', icon: 'payments' },
    { label: 'Utilities', href: '/admin/utilities', icon: 'utilities' },
    { label: 'Communications', href: '/admin/communications', icon: 'communications' },
    { label: 'Documents', href: '/admin/documents', icon: 'documents' },
    { label: 'Help', href: '/help', icon: 'help' },
  ];

  const adminLinks: NavLink[] = [
    { label: 'Dashboard', href: '/admin', icon: 'dashboard' },
    { label: 'Landlords', href: '/admin/project-managers', icon: 'landlords' },
    { label: 'Agents', href: '/admin/agents', icon: 'agents' },
    { label: 'Tenants', href: '/admin/tenants', icon: 'tenants' },
    { label: 'Payments', href: '/admin/payments', icon: 'payments' },
    { label: 'Communications', href: '/admin/communications', icon: 'communications' },
    { label: 'Help', href: '/help', icon: 'help' },
  ];

  const superAdminLinks: NavLink[] = [
    { label: 'Dashboard', href: '/super-admin', icon: 'dashboard' },
    { label: 'Landlords', href: '/super-admin/landlords', icon: 'landlords' },
    { label: 'Agents', href: '/super-admin/agents', icon: 'agents' },
    { label: 'Tenants', href: '/super-admin/tenants', icon: 'tenants' },
    { label: 'Payments', href: '/super-admin/payments', icon: 'payments' },
    { label: 'Analytics', href: '/super-admin/analytics', icon: 'analytics' },
    { label: 'Help', href: '/help', icon: 'help' },
  ];

  const navLinks = isTenant ? tenantLinks : (isAgent ? agentLinks : (isSuperAdmin ? superAdminLinks : (isAdmin ? adminLinks : landlordPMLinks)));

  const isLinkActive = (href: string) => pathname === href || (href !== '/' && pathname.startsWith(href + '/'));

  const firstName = (user?.user_metadata?.full_name || user?.email || 'there').split(' ')[0].split('@')[0];
  const roleLabel = isTenant ? 'Tenant' : isAgent ? 'Agent' : isSuperAdmin ? 'Super Admin' : isAdmin ? 'Admin' : isLandlord ? 'Project Manager' : 'User';
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <>
      {user && (
        <>
          <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
            <div className="sidebar-brand">
              <span className="logo-mark" style={{ width: 28, height: 28, borderRadius: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg>
              </span>
              Springfield Systems
            </div>

            <div className="sidebar-profile">
              <span className="user-avatar">{getInitials(user.user_metadata?.full_name || user.email)}</span>
              <div className="sidebar-profile-info">
                <div className="sidebar-profile-name">{user.user_metadata?.full_name || user.email}</div>
                <span className="sidebar-role-chip">{roleLabel}</span>
              </div>
            </div>

            <nav className="sidebar-nav">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setSidebarOpen(false)}
                  className={isLinkActive(link.href) ? 'active' : ''}
                >
                  <NavIcon name={link.icon} />
                  {link.label}
                </Link>
              ))}
            </nav>
            <button onClick={handleLogout} className="sidebar-logout">Logout</button>
          </div>

          <div className={`overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)}></div>
        </>
      )}

      <header className="app-header">
        <div className="app-header-content">
          {user && (
            <>
              <span className="user-avatar">{getInitials(user.user_metadata?.full_name || user.email)}</span>
              <span className="user-name" style={{ fontSize: '14px' }}>{user.user_metadata?.full_name || user.email}</span>
              <button className="menu-toggle" onClick={() => setSidebarOpen(true)} aria-label="Open menu">☰</button>
            </>
          )}
        </div>
      </header>
    </>
  );
}