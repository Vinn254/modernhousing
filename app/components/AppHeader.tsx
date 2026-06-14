'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';

export default function AppHeader() {
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>('user');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user?.email === 'vin.oumaotieno@gmail.com') {
        setUserRole('super-admin');
      } else if (data.user?.email?.includes('admin') || data.user?.user_metadata?.role === 'admin') {
        setUserRole('admin');
      } else {
        setUserRole('user');
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => listener?.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getInitials = (name: string) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const isAdmin = userRole === 'admin' || userRole === 'super-admin';
  const isSuperAdmin = userRole === 'super-admin';

  // Hide header on auth pages and dashboard pages (they have their own nav)
  const shouldHideHeader = pathname === '/' || pathname === '/login' || pathname === '/signup' || 
    pathname?.startsWith('/super-admin') || pathname?.startsWith('/admin');

  if (shouldHideHeader) {
    return null;
  }

  return (
    <>
      {user && (
        <>
          <button className="menu-toggle" onClick={() => setSidebarOpen(true)}>
            ☰
          </button>

          <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
            <div className="sidebar-header">
              <h2 className="sidebar-logo">Springfield</h2>
            </div>
            <nav className="sidebar-nav">
              <Link href="/dashboard">My Dashboard</Link>
              <Link href="/properties">Properties</Link>
              <Link href="/tenants">Tenants</Link>
              <Link href="/payments">Payments</Link>
              <button onClick={handleLogout} className="sidebar-logout">Logout</button>
            </nav>
          </div>

          <div className={`overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)}></div>
        </>
      )}

      <header className="app-header">
        <div className="app-header-content">
          <Link href="/" className="app-logo" title="Springfield Systems">Springfield Systems</Link>
          {user && (
            <div className="header-menu" ref={menuRef}>
              <button className="header-menu-trigger" onClick={() => setMenuOpen(!menuOpen)}>
                <span className="user-avatar">{getInitials(user.user_metadata?.full_name || user.email)}</span>
              </button>
              {menuOpen && (
                <div className="menu-dropdown">
                  <Link href="/dashboard">My Dashboard</Link>
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