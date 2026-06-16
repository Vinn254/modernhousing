'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

type Role = 'super_admin' | 'admin' | 'agent' | 'project_manager' | 'user';

type NavLink = {
  label: string;
  href: string;
};

const superAdminLinks: NavLink[] = [
  { label: 'Dashboard', href: '/super-admin' },
  { label: 'Admins', href: '/super-admin/admins' },
  { label: 'Agents', href: '/super-admin/agents' },
  { label: 'Properties', href: '/super-admin/properties' },
  { label: 'Tenants', href: '/super-admin/tenants' },
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
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));

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

  if (!user) return null;

  return (
    <div className="nav-links admin-nav-links" ref={menuRef}>
      <div className="nav-menu">
        <button type="button" onClick={() => setMenuOpen(!menuOpen)} className="nav-menu-trigger">
          <span className="user-avatar nav-user-avatar">{initials}</span>
        </button>

        {menuOpen && (
          <div className="nav-menu-dropdown">
            <div className="nav-menu-user">{fullName}</div>
            <div className="nav-menu-role">{role.replace('_', ' ')}</div>
            {links.map((link) => (
              <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)}>
                {link.label}
              </Link>
            ))}
            <button type="button" onClick={handleLogout}>Logout</button>
          </div>
        )}
      </div>

      <button className="nav-logout" onClick={handleLogout} type="button">
        Logout
      </button>
    </div>
  );
}
