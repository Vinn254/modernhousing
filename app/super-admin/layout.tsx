'use client';

import '../globals.css';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  useEffect(() => {
    const checkSuperAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      const userRole = user.user_metadata?.role;
      const isSuperAdmin = userRole === 'super_admin';
      if (!isSuperAdmin) {
        router.push('/');
      }
    };
    checkSuperAdmin();
  }, [router]);

  return <>{children}</>;