'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';

export default function HeaderNav() {
  const [user, setUser] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => listener?.subscription.unsubscribe();
  }, []);

  if (!user) return null;

  return (
    <>
      <button className="menu-toggle" onClick={() => setSidebarOpen(true)}>
        ☰
      </button>

      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2 className="sidebar-logo">Springfield</h2>
        </div>
        <nav className="sidebar-nav">
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/properties">Properties</Link>
          <Link href="/tenants">Tenants</Link>
          <Link href="/payments">Payments</Link>
        </nav>
      </div>

      <div className={`overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)}></div>
    </>
  );
}