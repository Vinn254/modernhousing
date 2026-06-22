'use client';

import '../globals.css';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      const userRole = user.user_metadata?.role;
      const isAdmin = user.email?.includes('admin') || userRole === 'admin' || userRole === 'project_manager';
      const isSuperAdmin = user.email === 'vin.oumaotieno@gmail.com';
      if (!isAdmin && !isSuperAdmin) {
        router.push('/');
      }
    };
    checkAdmin();
  }, [router]);

  return <>{children}</>;
}