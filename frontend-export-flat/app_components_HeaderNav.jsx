'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
export default function HeaderNav() {
    const [user, setUser] = useState(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
        const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
        return () => listener?.subscription.unsubscribe();
    }, []);
    if (!user)
        return null;
    const role = user.user_metadata?.role;
    const isTenant = role === 'tenant';
    return (<>
      <button className="menu-toggle" onClick={() => setSidebarOpen(true)} aria-label="Open menu">☰</button>

      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2 className="sidebar-logo">Springfield</h2>
        </div>
        <nav className="sidebar-nav">
          <Link href={isTenant ? '/tenant/dashboard' : '/dashboard'}>{isTenant ? 'Tenant Dashboard' : 'Dashboard'}</Link>
          {!isTenant && <Link href="/properties">Properties</Link>}
          {!isTenant && <Link href="/tenants">Tenants</Link>}
          {!isTenant && <Link href="/payments">Payments</Link>}
          <Link href="/terms">Terms & Conditions</Link>
        </nav>
      </div>

      <div className={`overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)}></div>
    </>);
}
